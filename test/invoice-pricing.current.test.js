const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function sampleItems() {
  return [
    {
      id: 1,
      name: 'Rice',
      sku: 'GRN-001',
      hsn: '1006',
      price: 640,
      qty: 1
    },
    {
      id: 8,
      name: 'Tea',
      sku: 'BEV-001',
      hsn: '0902',
      price: 140,
      qty: 1
    }
  ];
}

function sampleOrder() {
  return {
    id: 2001,
    customer: 'In-memory customer',
    coupon: 'SAVE10',
    items: sampleItems()
  };
}

test('CURRENT BEHAVIOUR: ledger pricing resolves GST from HSN and discounts before GST', () => {
  const totals = pricing.computeTotals(sampleItems(), 'SAVE10');

  assert.equal(totals.subtotal, 780);
  assert.equal(totals.discount, 78);
  assert.equal(totals.taxable, 702);
  assert.equal(totals.tax, 51.48);
  assert.equal(totals.cgst, 25.74);
  assert.equal(totals.sgst, 25.74);
  assert.equal(totals.total, 753.48);
  assert.deepEqual(totals.lines.map((line) => ({
    hsn: line.hsn,
    gstPercent: line.gstPercent,
    taxable: line.taxable,
    tax: line.tax
  })), [
    { hsn: '1006', gstPercent: 5, taxable: 576, tax: 28.8 },
    { hsn: '0902', gstPercent: 18, taxable: 126, tax: 22.68 }
  ]);
});

test('CURRENT BEHAVIOUR: invoice uses the HSN GST rate when an item has no gstRate', () => {
  const figures = invoice.computeInvoiceFigures(sampleOrder());

  assert.deepEqual(figures.rows.map((row) => ({
    hsn: row.hsn,
    gstPercent: row.gstPercent,
    lineTax: row.lineTax
  })), [
    { hsn: '1006', gstPercent: 5, lineTax: 28.8 },
    { hsn: '0902', gstPercent: 18, lineTax: 22.68 }
  ]);
  assert.equal(figures.tax, 51.48);
  assert.equal(figures.cgst, 25.74);
  assert.equal(figures.sgst, 25.74);
});

test('CURRENT BEHAVIOUR: invoice uses the ledger coupon discount and total', () => {
  const figures = invoice.computeInvoiceFigures(sampleOrder());

  assert.equal(figures.subtotal, 780);
  assert.equal(figures.discount, 78);
  assert.equal(figures.total, 753.48);
});

test('CURRENT BEHAVIOUR: invoice total and GST match ledger pricing for the same order', () => {
  const order = sampleOrder();
  const ledgerTotals = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
});

test('CURRENT BEHAVIOUR: invoice total and GST breakdown match the billed ledger total', () => {
  const order = sampleOrder();
  const ledgerTotals = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.tax, ledgerTotals.tax);
  assert.equal(invoiceFigures.cgst, ledgerTotals.cgst);
  assert.equal(invoiceFigures.sgst, ledgerTotals.sgst);
  assert.equal(invoiceFigures.discount, ledgerTotals.discount);
  assert.equal(invoiceFigures.total, ledgerTotals.total);
  assert.deepEqual(invoiceFigures.rows.map((row) => row.gstPercent), [5, 18]);
});
