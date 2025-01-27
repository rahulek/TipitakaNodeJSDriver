import neo4j from 'neo4j-driver';

export async function initDriver(uri, username, password, config) {
  return neo4j.driver(uri, neo4j.auth.basic(username, password), config);
}

export async function closeDriver(driver) {
  if (driver) {
    await driver.close();
  }
}
