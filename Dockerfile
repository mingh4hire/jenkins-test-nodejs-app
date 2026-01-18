FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

ENV MONGO_URI=mongodb://mongodb:27017/imagesdb

CMD ["npm", "start"]
