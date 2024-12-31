import neo4j from 'neo4j-driver';

let driver;

export function initDriver(uri, username, password, config) {
  return neo4j.driver(uri, neo4j.auth.basic(username, password), config);
}

export function getDriver() {
  return driver;
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
  }
}
