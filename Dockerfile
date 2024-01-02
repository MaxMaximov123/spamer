FROM node:18.16

COPY ./package.json ./package-lock.json ./
RUN npm install

COPY ./ ./

WORKDIR "/."

CMD ["npm", "run", "start"]