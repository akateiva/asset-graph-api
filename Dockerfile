FROM node:10-stretch

RUN mkdir -p /usr/src/asset-graph-api
WORKDIR /usr/src/asset-graph-api

# workaround for bad cache resolution in mongodb-memory-server
ENV MONGOMS_DOWNLOAD_DIR /usr/src/asset-graph-api/mongodb-binaries

COPY ./package.json .

RUN npm install --unsafe-perm

COPY ./ .
RUN npm run build
CMD npm run start
