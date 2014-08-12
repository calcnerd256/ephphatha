mkdir certs &&
cd certs &&
openssl req \
  -x509 -nodes -days 365 \
  -newkey rsa:4096 -keyout ephphatha.key -out ephphatha.cert
