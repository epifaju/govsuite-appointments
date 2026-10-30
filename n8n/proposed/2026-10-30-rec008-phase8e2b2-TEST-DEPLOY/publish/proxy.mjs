// Relais TCP local vers n8n TEST. Ne relaie aucune autre destination.
import { createServer, connect } from 'node:net';

const server = createServer((client) => {
  const upstream = connect(5678, 'rec008-n8n');
  client.pipe(upstream);
  upstream.pipe(client);
  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on('error', close);
  upstream.on('error', close);
});

server.listen(5682, '0.0.0.0');
