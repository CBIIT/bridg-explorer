FROM maj1/bridg:bridg-5.2.1-neo4j
MAINTAINER Mark A. Jensen <mark -dot- jensen -at- nih -dot com>
EXPOSE 3000 7687
ARG BRIDGEX_REPO=https://github.com/CBIIT/bridg-explorer.git
WORKDIR /opns
SHELL ["bash", "-c"]
RUN set -eux ; \
        apt-get update ; \
        apt-get install -y git tar curl xz-utils ; 
RUN mkdir -p /usr/local/lib/nodejs ; \
        cd /usr/local/lib/nodejs ; \
        curl https://nodejs.org/dist/v10.16.0/node-v10.16.0-linux-x64.tar.xz > node.tar.xz; \
        tar -xJvf node.tar.xz ;
RUN git clone $BRIDGEX_REPO
WORKDIR /opns/bridg-explorer
ADD start.sh .
RUN PATH=/usr/local/lib/nodejs/node-v10.16.0-linux-x64/bin:$PATH ; \
        npm install ; \
        npm run build
ENTRYPOINT ./start.sh




