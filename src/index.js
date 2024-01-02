import m3u8Decoder from './m3u8-decoder.js';
import fs from 'fs';
import m3u8stream from 'm3u8stream';
import Websocket from 'ws';


let webSocket = new Websocket(`wss://api.topfeeds.tech/v1`);

webSocket.send = ((send) => {
    return ({ type, data = null, id = null, relatedId = null, error = null }) => {
        if (!type) {
            throw new Error(`Parameter "message.type" is required.`);
        }

        let params = [
            type,
            data,
            id,
            relatedId,
            error,
        ];

        params = params.reduceRight((params, param) => {
            if (param !== null || params.length > 0) {
                params.unshift(param);
            }

            return params;
        }, []);

        let message = JSON.stringify(params);

        return send.call(webSocket, message);
    };
})(webSocket.send);


webSocket.on('open', () => {
    webSocket.send({
        type: `authorize`,
        data: {apiKey: "KqUbBFbuf2RvtREdSgE4K8B3WWPRUkGe"}
    });
});

webSocket.on('message', async (message) => {
try {
    message = message.toString();
    let originalMessage = message;
    let messageTypeMatch = null;
    
    try {
        message = ((type = null, data = null, id = null, relatedId = null, error = null) => {
            return {
                type,
                data,
                id,
                relatedId,
                error,
            }
        })(...JSON.parse(message));
    } catch (error) {
        logger.error(error);
        return;
    }

    if (message.error) {
        // logger.warn(`Collector: ${JSON.stringify(message.error)}`);
        return;
    }

    if (messageTypeMatch = message.type === 'authorized') {
        webSocket.send({
            type: "globalGameList/subscribe",
        });
    }

    if (messageTypeMatch = message.type === "globalGameList/created") {
        let globalGameList = Object.values(message.data);
        let gamesWithLivestream = [];
        for (let globalGame of globalGameList) {
            if (globalGame.globalLivestreams && Object.keys(globalGame.globalLivestreams).length) {
                gamesWithLivestream.push(Object.keys(globalGame.globalLivestreams)[0]);
                let livestreamId = Object.keys(globalGame.globalLivestreams)[0];
                console.log(`Start saving livestream #${livestreamId}`);

                let urlQuality = m3u8Decoder(
                    await (
                        await fetch(
                        `https://r2.topfeeds.tech/${livestreamId}/master.m3u8`
                        )
                    ).text()
                ).streams.at(-1).url;

                for (let i = 0; i < 100; i++) {
                    let stream = m3u8stream(
                        `https://r2.topfeeds.tech/${livestreamId}/${urlQuality}`)
                
                    stream.on('error', (error) => {
                        console.log(livestreamId, error);
                    });

                    stream.pipe(fs.createWriteStream(`livestreams/${livestreamId}_${i}.mp4`));
                }

                
                
            }
        }

        console.log('Count:', gamesWithLivestream.length);
    }

} catch(error) {
    logger.error(error);
}
});

webSocket.on('error', (error) => {
    logger.error(error);
});



// m3u8stream(
//     `https://r1.topfeeds.tech/495/${
//         m3u8Decoder(await (await fetch('https://r1.topfeeds.tech/466/master.m3u8')).text()).streams.at(-1).url
//     }`
//     )
//     .pipe(fs.createWriteStream('videofile.mp4'));


