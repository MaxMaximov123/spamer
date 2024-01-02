export default function m3u8Decoder(string) {
	function parseAttributeString(attributeString) {
		let attributes = [];
		let attributeStartsAt = 0;

		while (attributeStartsAt < attributeString.length) {
			let equalPosition = attributeString.indexOf('=', attributeStartsAt);

			if (attributeString[equalPosition + 1] === '"') {
				let endQuotePosition = attributeString.indexOf('"', equalPosition + 2);

				attributes.push({
					name: attributeString.slice(attributeStartsAt, equalPosition),
					value: attributeString.slice(equalPosition + 2, endQuotePosition),
				});

				attributeStartsAt = endQuotePosition + 2;
			} else {
				let commaPosition = attributeString.indexOf(',', equalPosition + 1);

				attributes.push({
					name: attributeString.slice(attributeStartsAt, equalPosition),
					value: (
						commaPosition > -1
							? attributeString.slice(equalPosition + 1, commaPosition)
							: attributeString.slice(equalPosition + 1)
					),
				});

				attributeStartsAt = commaPosition > -1 ? commaPosition + 1 : attributeString.length;
			}
		}

		return attributes;
	}

	let data = null;
	let lineStartsAt = 0;
	let lineEndsAt = null;
	let lastSection = null;
	let nextStreamNumber = 1;
	let nextSegmentNumber = null;

	do {
		lineEndsAt = string.indexOf('\n', lineStartsAt);
		let line = null;

		if (lineEndsAt > -1) {
			line = string.slice(lineStartsAt, lineEndsAt).trim();
			lineStartsAt = lineEndsAt + 1;
		} else {
			line = string.slice(lineStartsAt).trim();
			lineStartsAt = string.length;
		}

		if (!data) {
			if (line !== '#EXTM3U') {
				console.info([line]);
				throw new Error(`It's not a M3U8 playlist.`);
			}

			data = {};
			continue;
		}

		if (!line) {
			continue;
		}

		if (line === '#EXT-X-INDEPENDENT-SEGMENTS') {
			data.hasIndependentSegments = true;
			continue;
		}

		if (line.startsWith('#EXT-X-VERSION:')) {
			data.version = Number(line.slice('#EXT-X-VERSION:'.length));
			continue;
		}

		if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
			data.mediaSequence = Number(line.slice('#EXT-X-MEDIA-SEQUENCE:'.length));
			nextSegmentNumber = data.mediaSequence;
			continue;
		}

		if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE:')) {
			data.discontinutySequence = Number(line.slice('#EXT-X-DISCONTINUITY-SEQUENCE:'.length));
			continue;
		}

		if (line.startsWith('#EXT-X-TARGETDURATION:')) {
			data.targetDuration = Number(line.slice('#EXT-X-TARGETDURATION:'.length));
			continue;
		}

		if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
			data.playlistType = line.slice('#EXT-X-PLAYLIST-TYPE:'.length);
			continue;
		}

		if (line.startsWith('#EXTINF:')) {
			let duration = parseFloat(line.slice('#EXTINF:'.length));
			let segment = null;

			if (lastSection && lastSection.type === 'SEGMENT') {
				segment = lastSection.link;
			}

			if (!segment) {
				segment = {
					url: null,
				};
			}

			segment.duration = duration;

			lastSection = {
				type: 'SEGMENT',
				link: segment,
			};

			continue;
		}

		if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
			let time = new Date(line.slice('#EXT-X-PROGRAM-DATE-TIME:'.length)).getTime();
			let segment = null;

			if (lastSection && lastSection.type === 'SEGMENT') {
				segment = lastSection.link;
			}

			if (!segment) {
				segment = {
					url: null,
				};
			}

			segment.time = time;

			lastSection = {
				type: 'SEGMENT',
				link: segment,
			};

			continue;
		}

		if (line.startsWith('#EXT-X-MEDIA:')) {
			let streamAttributes = parseAttributeString(line.slice('#EXT-X-MEDIA:'.length)).reduce(
				(attributes, attribute) => {
					attributes[attribute.name] = attribute.value;
					return attributes;
				},
				{}
			);

			let stream = {
				attributes: streamAttributes,
				url: streamAttributes.URI,
				number: nextStreamNumber++,
			};

			delete streamAttributes.URI;
			data.streams ||= [];
			data.streams.push(stream);
			continue;
		}

		if (line.startsWith('#EXT-X-STREAM-INF:')) {
			let streamAttributes = parseAttributeString(line.slice('#EXT-X-STREAM-INF:'.length)).reduce(
				(attributes, attribute) => {
					attributes[attribute.name] = attribute.value;
					return attributes;
				},
				{}
			);

			let stream = {
				attributes: streamAttributes,
				url: null,
				number: null,
			};

			lastSection = {
				type: 'STREAM',
				link: stream,
			};

			continue;
		}

		if (line === '#EXT-X-DISCONTINUITY') {
			data.discontinuityBeforeSegmentNumber = nextSegmentNumber;
			continue;
		}

		if (line === '#EXT-X-ENDLIST') {
			data.isEnded = true;
			continue;
		}

		if (line[0] !== '#') {
			if (!lastSection) {
				throw new Error(`Can't define section for this data: "${line}".`);
			}

			if (lastSection.type === 'STREAM') {
				let stream = lastSection.link;
				stream.url = line;
				stream.number = nextStreamNumber++;
				lastSection = null;
				data.streams ||= [];
				data.streams.push(stream);
				continue;
			}

			if (lastSection.type === 'SEGMENT') {
				let segment = lastSection.link;
				segment.number = nextSegmentNumber++;
				segment.url = line;
				lastSection = null;
				data.segments ||= [];
				data.segments.push(segment);
				continue;
			}

			throw new Error(`Unknown section "${lastSection.type}" to put data in.`);
		}

		throw new Error(`Can't parse line: "${line}".`);
	} while (lineStartsAt < string.length);

	return data;
}
