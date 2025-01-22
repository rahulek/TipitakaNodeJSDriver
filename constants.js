import { config } from 'dotenv';
import * as path from 'path';

// Load config from .env
config();

export const NEO4J_URI = process.env.NEO4J_URI;
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

export const METADATA_TOPHEADER_NIKAYA = 'TOPHEADER_NIKAYA';
export const METADATA_TOPHEADER_TEXT = 'TOPHEADER_TEXT';
export const METADATA_BOOK = 'BOOK';
export const METADATA_NIKAYA = 'NIKAYA';
export const METADATA_SUB_SECTION_TITLE = 'SUBSECTION';
export const METADATA_SUB_SECTION_TYPE_SUTTA = 'SUBSECTION_SUTTA';
export const METADATA_SUB_SECTION_TYPE_VAGGA = 'SUBSECTION_VAGGA';
export const METADATA_GATHA = 'GATHA';
export const METADATA_PALI_TEXT_PARA = 'PALI_TEXT_PARA';
export const METADATA_TRAILER = 'TRAILER';
export const METADATA_OUTER_TRAILER = 'OUTER_TRAILER';
