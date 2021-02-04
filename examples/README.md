# Examples

All examples work standalone.

**!!! The [publisher example](publisher) is the most up to date!!**

All other examples may be a bit out of date as they show only very small
configuration options.

## Local SSL Certificate (HTTPS)

To run the examples locally on a mac, the respective selfsigned SSL certificate has to be added to the mac's keychain, like so:

`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain publisher/certs/selfsigned.crt`

Every example has its own certificate.
