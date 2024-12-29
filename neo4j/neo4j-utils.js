import {
  isInt,
  isDate,
  isDateTime,
  isTime,
  isLocalDateTime,
  isLocalTime,
  isDuration,
} from 'neo4j-driver';

// Valid Order directions
const ORDER_ASC = 'ASC';
const ORDER_DESC = 'DESC';
const ORDERS = [ORDER_ASC, ORDER_DESC];

export function getPagination(req, validSort = []) {
  let { q, limit, skip, sort, order } = req.query;

  // Only accept valid orderby fields
  if (sort !== undefined && !validSort.includes(sort)) {
    sort = undefined;
  }

  // Only accept ASC/DESC values
  if (order === undefined || !ORDERS.includes(order.toUpperCase())) {
    order = ORDER_ASC;
  }

  return {
    q,
    sort,
    order,
    limit: parseInt(limit || 6),
    skip: parseInt(skip || 0),
  };
}

export function getUserId(req) {
  return req.user ? req.user.userId : undefined;
}

export function toNativeTypes(properties) {
  return Object.fromEntries(
    Object.keys(properties).map((key) => {
      let value = valueToNativeType(properties[key]);

      return [key, value];
    })
  );
}

function valueToNativeType(value) {
  if (Array.isArray(value)) {
    value = value.map((innerValue) => valueToNativeType(innerValue));
  } else if (isInt(value)) {
    value = value.toNumber();
  } else if (
    isDate(value) ||
    isDateTime(value) ||
    isTime(value) ||
    isLocalDateTime(value) ||
    isLocalTime(value) ||
    isDuration(value)
  ) {
    value = value.toString();
  } else if (
    typeof value === 'object' &&
    value !== undefined &&
    value !== null
  ) {
    value = toNativeTypes(value);
  }

  return value;
}
