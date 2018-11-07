FROM node:10-stretch

RUN mkdir -p /usr/src/asset-graph-api
WORKDIR /usr/src/asset-graph-api

COPY ./package.json .
RUN npm install
COPY ./ .
RUN npm run build
CMD npm run start
