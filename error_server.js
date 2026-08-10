const http = require('http');
http.createServer((req, res) => {
  console.log('RECEIVED URL:', req.url);
  res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
  res.end('ok');
}).listen(3000, () => console.log('Listening on 3000...'));
