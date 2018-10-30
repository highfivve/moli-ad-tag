import test from 'ava';

import { CookieService } from './cookieService';

const cookieService = new CookieService();

test('cookieService get cookie for non existing key', (t) => {
  t.false(cookieService.exists('nonexistingkey'));
  t.true(cookieService.get('nonexistingkey') === null);
});

test('cookieService set and get cookie for single key', (t) => {
  cookieService.set('test1', 'mystring');

  t.true(cookieService.exists('test1'));
  t.true(cookieService.get('test1') === 'mystring');

  t.false(cookieService.exists('nonexistingkey'));
});

test('cookieService set and get cookie for multiple keys', (t) => {
  cookieService.set('test1', 'mystring');
  cookieService.set('test2', 'yourstring');

  t.true(cookieService.get('test1') === 'mystring');
  t.true(cookieService.get('test2') === 'yourstring');

  t.false(cookieService.exists('nonexistingkey'));
});
