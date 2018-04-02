FROM ubuntu:latest

EXPOSE 3000
RUN apt-get update && apt-get -y install nodejs npm wget vim
RUN wget https://nodejs.org/dist/v8.10.0/node-v8.10.0-linux-x64.tar.xz
RUN xz -d node-v8.10.0-linux-x64.tar.xz
RUN tar -xvf node-v8.10.0-linux-x64.tar
RUN cp -rf node-v8.10.0-linux-x64/* /usr/local

ADD / /warlock
WORKDIR /warlock
RUN npm install 

CMD npm start
