FROM node:18-alpine

WORKDIR /usr/src/app

COPY app/package.json ./
RUN npm install --omit=dev

COPY app/ ./

# Overwritten per-branch by the Jenkins pipeline before `docker build` runs,
# but keep a sane default here too so `docker build` works standalone.
ARG APP_PORT=3000
ENV PORT=$APP_PORT

EXPOSE $PORT

CMD ["node", "server.js"]
