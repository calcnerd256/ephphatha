mkdir certs &&
cd certs &&
openssl req \
  -x509 -nodes -days 365 \
  -newkey rsa:8192 -keyout ephphatha.key -out ephphatha.cert