FROM node:12

ADD ./ /data/dna-mongo

WORKDIR /data/dna-mongo

RUN yarn install
WORKDIR /data/dna-mongo/node_modules/bitsharesjs-ws
RUN yarn install 
RUN yarn build
WORKDIR /data/dna-mongo/node_modules/bitsharesjs
RUN yarn install --ignore-scripts
RUN cp -rf /data/dna-mongo/node_modules/bitsharesjs-ws /data/dna-mongo/node_modules/bitsharesjs/node_modules/
RUN yarn  build


WORKDIR /data/dna-mongo

# "mongodb://mongo:mongo@localhost/dnamongo?authSource=admin"
ARG MONGODB
# DNA
ARG CORE_TOKEN_SYMBOL
# 1.3.0
ARG CORE_TOKEN_ID
# DNA
ARG KEY_PREFIX
# 24938a99198d850bb7d79010c1325fb63fde63e8e477a5443ff5ce50ab867055
ARG CHAIN_ID
# "Fri Aug 5 2020 21:00:00 GMT+0800"
ARG GENESIS_TIME
# "wss://mvsdna.info/ws"
ARG WS_RPC


ENV MONGODB ${MONGODB}
ENV CORE_TOKEN_SYMBOL ${CORE_TOKEN_SYMBOL}
ENV CORE_TOKEN_ID ${CORE_TOKEN_ID}
ENV KEY_PREFIX ${KEY_PREFIX}
ENV CHAIN_ID ${CHAIN_ID}
ENV GENESIS_TIME ${GENESIS_TIME}
ENV WS_RPC ${WS_RPC}

ENV NODE_ENV production

CMD node app.js
