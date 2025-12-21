const { Client } = require("pg");

function createClient({ host, port, user, password, database }) {
  return new Client({
    host,
    port,
    user,
    password,
    database,
  });
}

module.exports = { createClient };
