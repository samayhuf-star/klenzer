import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findDuplicateGroups, mergeItemCount, nameScore, normalizeEmail, normalizeName, normalizePhone, planMerge, type ContactRecord } from '../src/lib/contacts-logic';

const c = (id: string, name: string, phones: string[] = [], emails: string[] = []): ContactRecord => ({ id, name, phones, emails });

describe('contact normalisation', () => {
  it('normalises names: case, accents, punctuation, honorifics and word order', () => {
    assert.equal(normalizeName('Dr. José  Álvarez'), normalizeName('alvarez jose'));
    assert.equal(normalizeName('  PRIYA sharma '), 'priya sharma');
    assert.equal(normalizeName(''), '');
  });

  it('normalises phones to the last 10 digits and ignores short codes', () => {
    assert.equal(normalizePhone('+91 98100 12345'), '9810012345');
    assert.equal(normalizePhone('098100 12345'), '9810012345');
    assert.equal(normalizePhone('0091-98100-12345'), '9810012345');
    assert.equal(normalizePhone('+1 (415) 555-0134'), '4155550134');
    assert.equal(normalizePhone('121'), null);
  });

  it('normalises emails', () => {
    assert.equal(normalizeEmail('  Priya@Example.COM '), 'priya@example.com');
    assert.equal(normalizeEmail('not an email'), null);
  });
});

describe('duplicate detection', () => {
  const list = [
    c('1', 'Priya Sharma', ['+91 98100 12345'], ['priya@example.com']),
    c('2', 'priya sharma', ['098100 12345']),
    c('3', 'P. S.', ['+91-98100-12345']),
    c('4', 'Rahul Mehta', ['+1 (415) 555-0134']),
    c('5', 'Rahul Mehta', [], ['rahul@example.com']),
    c('6', 'Sam Lee', ['+1 212 555 0199']),
    c('7', 'Office', [], ['Rahul@example.com']),
  ];

  it('groups by name, by phone and by email, transitively', () => {
    const groups = findDuplicateGroups(list);
    const ids = groups.map((g) => g.contacts.map((x) => x.id).sort());
    assert.deepEqual(ids, [
      ['1', '2', '3'],
      ['4', '5', '7'],
    ]);
    assert.deepEqual(groups[0].reasons, ['name', 'phone']);
    assert.deepEqual(groups[1].reasons, ['name', 'email']);
  });

  it('leaves unique contacts alone', () => {
    assert.deepEqual(findDuplicateGroups([c('a', 'Ann', ['111 222 3333']), c('b', 'Ben', ['444 555 6666'])]), []);
  });
});

describe('merge planning', () => {
  it('keeps the best name, unions phones and emails without duplicates, and removes the rest', () => {
    const plan = planMerge([
      c('2', 'priya sharma', ['098100 12345']),
      c('1', 'Priya Sharma', ['+91 98100 12345'], ['priya@example.com']),
      c('3', 'Priya K Sharma', ['+91 98100 99999'], ['PRIYA@example.com', 'p.k@example.com']),
    ]);
    assert.equal(plan.keepId, '3');
    assert.equal(plan.name, 'Priya K Sharma');
    assert.deepEqual(plan.phones, ['+91 98100 99999', '098100 12345']);
    assert.deepEqual(plan.emails, ['PRIYA@example.com', 'p.k@example.com']);
    assert.deepEqual(plan.addPhones, ['098100 12345']);
    assert.deepEqual(plan.addEmails, []);
    assert.deepEqual(plan.removeIds.sort(), ['1', '2']);
  });

  it('breaks name ties by the contact with more details', () => {
    const plan = planMerge([c('a', 'Rahul Mehta'), c('b', 'Rahul Mehta', ['4155550134'], ['r@example.com'])]);
    assert.equal(plan.keepId, 'b');
    assert.deepEqual(plan.removeIds, ['a']);
  });

  it('prefers properly cased names', () => {
    assert.ok(nameScore('Priya Sharma') > nameScore('priya sharma'));
    assert.ok(nameScore('') < 0);
  });

  it('counts each removed contact as one free item', () => {
    const p1 = planMerge([c('1', 'A B'), c('2', 'A B'), c('3', 'A B')]);
    const p2 = planMerge([c('4', 'C D'), c('5', 'C D')]);
    assert.equal(mergeItemCount([p1, p2]), 3);
  });

  it('refuses a group of one', () => {
    assert.throws(() => planMerge([c('1', 'Solo')]));
  });
});
