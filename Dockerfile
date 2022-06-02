FROM node:14.9.0

WORKDIR /app

RUN apt install -y git
RUN npm install -g typescript ts-node

COPY . /app/

RUN npm ci
RUN npm run build

EXPOSE 8097

CMD [ "node", "/app/dist/bootstrap/index.js" ]
