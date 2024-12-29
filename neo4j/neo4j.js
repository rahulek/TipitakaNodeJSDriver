import neo4j from 'neo4j-driver';

let driver;

export async function initDriver(uri, username, password, config) {
  driver = neo4j.driver(uri, neo4j.auth.basic(username, password), config);
  return driver;
}

export function getDriver() {
  return driver;
}

export async function closeDriver() {
  if (driver) {
    await driver.close();
  }
}
