FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.10.0-alpine3.19
ENTRYPOINT /app
COPY . .
ENTRYPOINT ["node"]
CMD ["index.js"]