(function (global) {
  'use strict';

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = String(value || '').replace(',', '.');
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function calculateBudget(data) {
    const measurements = data.measurements || [];
    const totalArea = measurements.reduce((sum, item) => {
      return sum + toNumber(item.width) * toNumber(item.height);
    }, 0);
    const products = data.products || [];
    const productTotals = products.map((product) => {
      const productArea = measurements.reduce((sum, item) => {
        const selectedProducts = item.productIds || [];
        if (!selectedProducts.includes(product.id)) return sum;
        return sum + toNumber(item.width) * toNumber(item.height);
      }, 0);
      const requiredKg = productArea * toNumber(product.consumption);
      const grossValue = requiredKg * toNumber(product.price);

      return {
        id: product.id,
        name: product.name || 'Produto',
        application: product.application || '',
        area: round2(productArea),
        requiredKg: round2(requiredKg),
        grossValue: round2(grossValue)
      };
    });
    const requiredKg = productTotals.reduce((sum, product) => sum + product.requiredKg, 0);
    const grossValue = productTotals.reduce((sum, product) => sum + product.grossValue, 0);
    const rawDiscount = toNumber(data.discountValue);
    const discountValue = data.discountType === 'fixed'
      ? Math.min(rawDiscount, grossValue)
      : Math.min(grossValue * (rawDiscount / 100), grossValue);
    const finalValue = Math.max(grossValue - discountValue, 0);

    return {
      totalArea: round2(totalArea),
      requiredKg: round2(requiredKg),
      grossValue: round2(grossValue),
      discountValue: round2(discountValue),
      finalValue: round2(finalValue),
      productTotals
    };
  }

  global.RevestHouseCalculator = { calculateBudget, toNumber, round2 };
})(typeof window !== 'undefined' ? window : globalThis);
