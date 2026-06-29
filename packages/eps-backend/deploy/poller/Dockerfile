# Poller image: docker CLI + compose plugin + skopeo + redis-cli + curl + bash.
# docker:cli is Alpine-based and ships the compose plugin.
FROM docker:27-cli
RUN apk add --no-cache bash skopeo redis curl
COPY poll.sh /usr/local/bin/poll.sh
RUN chmod +x /usr/local/bin/poll.sh
ENTRYPOINT ["/usr/local/bin/poll.sh"]
