/**
 * One-shot fix: sets correct collection-level permissions on the notifications
 * collection so that:
 *   - Students can READ (query) notifications
 *   - Admin (any logged-in user) can CREATE notification documents
 *   - Any user can UPDATE (mark as read)
 *
 * This fixes the 401 Unauthorized error when admin tries to send notifications.
 *
 * Run from the setup/ directory:
 *   node fix-notif-perms.js
 *
 * Requires APPWRITE_API_KEY in setup/.env
 */

require('dotenv').config();
const { Client, Databases, Permission, Role } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT  || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '6a332fd80025b72ea503')
  .setKey(process.env.APPWRITE_API_KEY);

const dbs = new Databases(client);
const DB  = process.env.APPWRITE_DATABASE_ID || '6a371466003655df6e05';

async function fix() {
  console.log('Patching notifications collection permissions...');
  try {
    await dbs.updateCollection(DB, 'notifications', 'Notifications', [
      Permission.read(Role.users()),     /* students can query the collection   */
      Permission.create(Role.users()),   /* admin session can create documents  */
      Permission.update(Role.users()),   /* students can mark notifications read */
      Permission.delete(Role.label('admin')),
    ], true /* documentSecurity: individual doc perms still apply */);
    console.log('Done! Admin can now send notifications without 401 errors.');
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Make sure APPWRITE_API_KEY is set in setup/.env');
  }
}

fix();
