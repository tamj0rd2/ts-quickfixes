# Install Stage
FROM node:14.16.0-alpine as base

RUN mkdir -p /usr/app
WORKDIR /usr/app

ENV HUSKY_SKIP_INSTALL=true
ENV HUSKY=0
RUN apk add --no-cache --virtual .build-deps alpine-sdk python

RUN apk -q update && apk add netcat-openbsd

COPY package.json package-lock.json ./
RUN npm ci
