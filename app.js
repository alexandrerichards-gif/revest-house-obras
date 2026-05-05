(function () {
  'use strict';

  const STORAGE_KEY = 'revest-house-obras-budget-v1';
  const SAVED_BUDGETS_KEY = 'revest-house-obras-saved-budgets-v2';
  const CURRENT_BUDGET_KEY = 'revest-house-obras-current-budget-id-v2';
  const SAVED_SELLERS_KEY = 'revest-house-obras-saved-sellers-v1';
  const { calculateBudget, toNumber, round2 } = window.RevestHouseCalculator;
  let currentBudgetId = localStorage.getItem(CURRENT_BUDGET_KEY) || '';

  const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fieldIds = [
    'clientName', 'clientWhatsapp', 'clientEmail', 'clientDocument', 'clientNotes',
    'jobName', 'jobType', 'jobAddress', 'jobDistrict', 'jobCity', 'budgetDate',
    'discountType', 'discountValue', 'commercialNotes',
    'sellerName', 'sellerWhatsapp', 'sellerEmail'
  ];

  const elements = {};
  fieldIds.forEach((id) => { elements[id] = document.getElementById(id); });
  elements.form = document.getElementById('budgetForm');
  elements.productsList = document.getElementById('productsList');
  elements.productTemplate = document.getElementById('productTemplate');
  elements.addProductBtn = document.getElementById('addProductBtn');
  elements.measurementsList = document.getElementById('measurementsList');
  elements.measurementTemplate = document.getElementById('measurementTemplate');
  elements.addMeasurementBtn = document.getElementById('addMeasurementBtn');
  elements.sellersList = document.getElementById('sellersList');
  elements.sellerTemplate = document.getElementById('sellerTemplate');
  elements.sellerSelect = document.getElementById('sellerSelect');
  elements.addSellerBtn = document.getElementById('addSellerBtn');
  elements.applySellerBtn = document.getElementById('applySellerBtn');
  elements.savedSellersCount = document.getElementById('savedSellersCount');
  elements.newBudgetBtn = document.getElementById('newBudgetBtn');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.pdfBtn = document.getElementById('pdfBtn');
  elements.savedBudgetsSelect = document.getElementById('savedBudgetsSelect');
  elements.loadBudgetBtn = document.getElementById('loadBudgetBtn');
  elements.deleteBudgetBtn = document.getElementById('deleteBudgetBtn');
  elements.savedBudgetsCount = document.getElementById('savedBudgetsCount');
  elements.productSummaryList = document.getElementById('productSummaryList');

  [
    'totalAreaDisplay', 'summaryArea', 'summaryKg', 'summaryGross', 'summaryDiscount', 'summaryFinal',
    'previewClient', 'previewJob', 'previewProduct', 'previewArea', 'previewKg', 'previewFinal'
  ].forEach((id) => { elements[id] = document.getElementById(id); });

  function createId(prefix) {
    if (window.crypto && window.crypto.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDecimal(value) {
    return decimalFormatter.format(round2(value));
  }

  function formatArea(value) {
    return `${formatDecimal(value)} m2`;
  }

  function formatKg(value) {
    return `${formatDecimal(value)} kg`;
  }

  function formatQuantity(value, unit) {
    return `${formatDecimal(value)} ${unit || 'kg'}`;
  }

  function formatTotalQuantity(totals) {
    const usedUnits = Array.from(new Set(totals.productTotals.filter((product) => product.requiredKg > 0).map((product) => product.unit || 'kg')));
    if (usedUnits.length === 1) return formatQuantity(totals.requiredKg, usedUnits[0]);
    return `${formatDecimal(totals.requiredKg)} un.`;
  }

  function formatMoney(value) {
    return moneyFormatter.format(round2(value));
  }

  function emptyProduct() {
    return {
      id: createId('product'),
      name: '',
      application: '',
      unit: 'kg',
      consumption: '',
      price: '',
      packageSize: '',
      notes: ''
    };
  }

  function emptyMeasurement(productIds) {
    return {
      id: createId('measurement'),
      name: '',
      width: '',
      height: '',
      productIds: productIds || []
    };
  }

  function emptySeller() {
    return {
      id: createId('seller'),
      name: '',
      whatsapp: '',
      email: ''
    };
  }

  function defaultData() {
    const product = emptyProduct();
    return {
      clientName: '', clientWhatsapp: '', clientEmail: '', clientDocument: '', clientNotes: '',
      jobName: '', jobType: '', jobAddress: '', jobDistrict: '', jobCity: '', budgetDate: new Date().toISOString().slice(0, 10),
      discountType: 'percent', discountValue: '', commercialNotes: '',
      sellerName: '', sellerWhatsapp: '', sellerEmail: '',
      products: [product],
      measurements: [emptyMeasurement([product.id])]
    };
  }

  function getSavedBudgets() {
    try {
      const stored = localStorage.getItem(SAVED_BUDGETS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  function getSavedSellers() {
    try {
      const stored = localStorage.getItem(SAVED_SELLERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  function setSavedSellers(sellers) {
    localStorage.setItem(SAVED_SELLERS_KEY, JSON.stringify(sellers));
  }

  function isSellerFilled(seller) {
    const name = (seller.name || '').trim();
    const whatsapp = (seller.whatsapp || '').trim();
    const email = (seller.email || '').trim();
    return Boolean((name && name !== 'Vendedor sem nome') || whatsapp || email);
  }

  function readSellers() {
    return Array.from(elements.sellersList.querySelectorAll('.seller-item')).map((item) => ({
      id: item.dataset.sellerId,
      name: item.querySelector('.saved-seller-name').value,
      whatsapp: item.querySelector('.saved-seller-whatsapp').value,
      email: item.querySelector('.saved-seller-email').value
    }));
  }

  function addSeller(seller) {
    const data = seller || emptySeller();
    const clone = elements.sellerTemplate.content.firstElementChild.cloneNode(true);
    clone.dataset.sellerId = data.id;
    clone.querySelector('.saved-seller-name').value = data.name || '';
    clone.querySelector('.saved-seller-whatsapp').value = data.whatsapp || '';
    clone.querySelector('.saved-seller-email').value = data.email || '';
    elements.sellersList.appendChild(clone);
    updateSellerTitles();
  }

  function focusEmptySellerCard() {
    const emptyCard = Array.from(elements.sellersList.querySelectorAll('.seller-item')).find((item) => {
      const name = item.querySelector('.saved-seller-name').value.trim();
      const whatsapp = item.querySelector('.saved-seller-whatsapp').value.trim();
      const email = item.querySelector('.saved-seller-email').value.trim();
      return !name && !whatsapp && !email;
    });

    if (!emptyCard) return false;
    emptyCard.querySelector('.saved-seller-name').focus();
    emptyCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function updateSellerTitles() {
    readSellers().forEach((seller, index) => {
      const item = elements.sellersList.querySelector(`[data-seller-id="${seller.id}"]`);
      item.querySelector('.seller-title').textContent = seller.name || `Vendedor ${index + 1}`;
    });
  }

  function saveSellers() {
    const sellers = readSellers().filter(isSellerFilled);
    setSavedSellers(sellers);
    renderSellerSelect();
  }

  function renderSellers() {
    const sellers = getSavedSellers().filter(isSellerFilled);
    setSavedSellers(sellers);

    elements.sellersList.innerHTML = '';
    sellers.forEach(addSeller);
    renderSellerSelect();
  }

  function renderSellerSelect() {
    const currentValue = elements.sellerSelect.value;
    const sellers = getSavedSellers().filter(isSellerFilled);
    setSavedSellers(sellers);
    elements.sellerSelect.innerHTML = '';

    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Selecione um vendedor';
    elements.sellerSelect.appendChild(blank);

    sellers.forEach((seller) => {
      const option = document.createElement('option');
      option.value = seller.id;
      option.textContent = seller.name || 'Vendedor sem nome';
      elements.sellerSelect.appendChild(option);
    });

    elements.sellerSelect.value = sellers.some((seller) => seller.id === currentValue) ? currentValue : '';
    elements.savedSellersCount.textContent = String(sellers.length);
  }

  function applySelectedSeller() {
    saveSellers();
    const sellerId = elements.sellerSelect.value;
    const seller = getSavedSellers().find((item) => item.id === sellerId);
    if (!seller) return;

    elements.sellerName.value = seller.name || '';
    elements.sellerWhatsapp.value = seller.whatsapp || '';
    elements.sellerEmail.value = seller.email || '';
    updateUi();
    saveData();
  }

  function setSavedBudgets(budgets) {
    localStorage.setItem(SAVED_BUDGETS_KEY, JSON.stringify(budgets));
  }

  function makeBudgetTitle(data) {
    const client = (data.clientName || '').trim();
    const job = (data.jobName || '').trim();
    const date = data.budgetDate || new Date().toISOString().slice(0, 10);
    if (client && job) return `${client} - ${job}`;
    if (client) return client;
    if (job) return job;
    return `Orcamento ${date}`;
  }

  function renderSavedBudgets() {
    const budgets = getSavedBudgets().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    elements.savedBudgetsSelect.innerHTML = '';

    budgets.forEach((budget) => {
      const option = document.createElement('option');
      option.value = budget.id;
      option.textContent = budget.title;
      elements.savedBudgetsSelect.appendChild(option);
    });

    if (currentBudgetId) elements.savedBudgetsSelect.value = currentBudgetId;
    elements.deleteBudgetBtn.disabled = budgets.length <= 1;
    elements.savedBudgetsCount.textContent = String(budgets.length);
  }

  function createBudgetRecord(data, id) {
    const normalizedData = migrateData(data);
    return {
      id: id || createId('budget'),
      title: makeBudgetTitle(normalizedData),
      updatedAt: new Date().toISOString(),
      data: normalizedData
    };
  }

  function upsertCurrentBudget(data) {
    const budgets = getSavedBudgets();
    if (!currentBudgetId) currentBudgetId = createId('budget');
    const record = createBudgetRecord(data, currentBudgetId);
    const index = budgets.findIndex((budget) => budget.id === currentBudgetId);

    if (index >= 0) budgets[index] = record;
    else budgets.push(record);

    setSavedBudgets(budgets);
    localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record.data));
    renderSavedBudgets();
  }

  function initializeBudgetStorage() {
    let budgets = getSavedBudgets();

    if (!budgets.length) {
      const legacy = loadLegacyData();
      const record = createBudgetRecord(legacy);
      budgets = [record];
      currentBudgetId = record.id;
      setSavedBudgets(budgets);
      localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
      return;
    }

    if (!currentBudgetId || !budgets.some((budget) => budget.id === currentBudgetId)) {
      currentBudgetId = budgets[0].id;
      localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    }
  }

  function migrateData(data) {
    const merged = { ...defaultData(), ...(data || {}) };

    if (!Array.isArray(merged.products)) {
      const migratedProduct = {
        id: createId('product'),
        name: data?.productName || '',
        application: data?.productApplication || '',
        unit: data?.productUnit || 'kg',
        consumption: data?.productConsumption || '',
        price: data?.productPrice || '',
        packageSize: data?.productPackageSize || '',
        notes: data?.productNotes || ''
      };

      if (!migratedProduct.consumption && data?.productYield) {
        const previousYield = toNumber(data.productYield);
        migratedProduct.consumption = previousYield > 0 ? String(round2(1 / previousYield)) : '';
      }

      merged.products = [migratedProduct];
      merged.measurements = (data?.measurements || []).map((item) => ({
        ...item,
        id: item.id || createId('measurement'),
        productIds: item.productIds || [migratedProduct.id]
      }));
    }

    if (!merged.products.length) merged.products = [emptyProduct()];
    const productIds = merged.products.map((product) => product.id);
    merged.measurements = (merged.measurements && merged.measurements.length ? merged.measurements : [emptyMeasurement(productIds)]).map((item) => ({
      ...item,
      id: item.id || createId('measurement'),
      productIds: (item.productIds || []).filter((id) => productIds.includes(id))
    }));

    return merged;
  }

  function readProducts() {
    return Array.from(elements.productsList.querySelectorAll('.product-item')).map((item) => ({
      id: item.dataset.productId,
      name: item.querySelector('.product-name').value,
      application: item.querySelector('.product-application').value,
      unit: item.querySelector('.product-unit').value,
      consumption: item.querySelector('.product-consumption').value,
      price: item.querySelector('.product-price').value,
      packageSize: item.querySelector('.product-package-size').value,
      notes: item.querySelector('.product-notes').value
    }));
  }

  function readMeasurements() {
    return Array.from(elements.measurementsList.querySelectorAll('.measurement-item')).map((item) => ({
      id: item.dataset.measurementId,
      name: item.querySelector('.measurement-name').value,
      width: item.querySelector('.measurement-width').value,
      height: item.querySelector('.measurement-height').value,
      productIds: Array.from(item.querySelectorAll('.product-choice-input:checked')).map((input) => input.value)
    }));
  }

  function readFormData() {
    const data = {};
    fieldIds.forEach((id) => { data[id] = elements[id].value; });
    data.products = readProducts();
    data.measurements = readMeasurements();
    return data;
  }

  function writeFormData(data) {
    const merged = migrateData(data);
    fieldIds.forEach((id) => { elements[id].value = merged[id] || ''; });

    elements.productsList.innerHTML = '';
    merged.products.forEach(addProduct);

    elements.measurementsList.innerHTML = '';
    merged.measurements.forEach(addMeasurement);
    renderAllProductChoices();
    updateUi();
  }

  function saveData() {
    upsertCurrentBudget(readFormData());
  }

  function saveCurrentBudgetSilently() {
    const budgets = getSavedBudgets();
    if (!currentBudgetId) currentBudgetId = createId('budget');
    const record = createBudgetRecord(readFormData(), currentBudgetId);
    const index = budgets.findIndex((budget) => budget.id === currentBudgetId);

    if (index >= 0) budgets[index] = record;
    else budgets.push(record);

    setSavedBudgets(budgets);
    localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record.data));
  }

  function loadLegacyData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultData();
    } catch (error) {
      return defaultData();
    }
  }

  function loadData() {
    const budgets = getSavedBudgets();
    const selected = budgets.find((budget) => budget.id === currentBudgetId) || budgets[0];
    return selected ? selected.data : defaultData();
  }

  function addProduct(product) {
    const data = product || emptyProduct();
    const clone = elements.productTemplate.content.firstElementChild.cloneNode(true);
    clone.dataset.productId = data.id;
    clone.querySelector('.product-name').value = data.name || '';
    clone.querySelector('.product-application').value = data.application || '';
    clone.querySelector('.product-unit').value = data.unit || 'kg';
    clone.querySelector('.product-consumption').value = data.consumption || '';
    clone.querySelector('.product-price').value = data.price || '';
    clone.querySelector('.product-package-size').value = data.packageSize || '';
    clone.querySelector('.product-notes').value = data.notes || '';
    elements.productsList.appendChild(clone);
    updateProductTitles();
  }

  function addMeasurement(measurement) {
    const clone = elements.measurementTemplate.content.firstElementChild.cloneNode(true);
    const data = measurement || emptyMeasurement(readProducts().map((product) => product.id));
    clone.dataset.measurementId = data.id;
    clone.dataset.productIds = JSON.stringify(data.productIds || []);
    clone.querySelector('.measurement-name').value = data.name || '';
    clone.querySelector('.measurement-width').value = data.width || '';
    clone.querySelector('.measurement-height').value = data.height || '';
    elements.measurementsList.appendChild(clone);
    updateMeasurementTotal(clone);
  }

  function updateProductTitles() {
    readProducts().forEach((product, index) => {
      const item = elements.productsList.querySelector(`[data-product-id="${product.id}"]`);
      const name = product.name || `Produto ${index + 1}`;
      item.querySelector('.product-title').textContent = name;
    });
  }

  function renderProductChoices(measurementItem) {
    const selected = JSON.parse(measurementItem.dataset.productIds || '[]');
    const list = measurementItem.querySelector('.product-choice-list');
    const products = readProducts();

    list.innerHTML = '';
    if (!products.length) {
      list.innerHTML = '<p class="empty-text">Cadastre um produto para selecionar.</p>';
      return;
    }

    products.forEach((product) => {
      const label = document.createElement('label');
      label.className = 'product-choice';

      const input = document.createElement('input');
      input.className = 'product-choice-input';
      input.type = 'checkbox';
      input.value = product.id;
      input.checked = selected.includes(product.id);

      const span = document.createElement('span');
      span.textContent = product.name || 'Produto sem nome';

      label.append(input, span);
      list.appendChild(label);
    });
  }

  function renderAllProductChoices() {
    elements.measurementsList.querySelectorAll('.measurement-item').forEach(renderProductChoices);
  }

  function updateMeasurementTotal(item) {
    const width = toNumber(item.querySelector('.measurement-width').value);
    const height = toNumber(item.querySelector('.measurement-height').value);
    item.querySelector('.measurement-total strong').textContent = formatArea(width * height);
  }

  function updateProductSummary(totals) {
    elements.productSummaryList.innerHTML = '';
    if (!totals.productTotals.length) return;

    const header = document.createElement('div');
    header.className = 'product-summary-item product-summary-header';
    header.innerHTML = `
      <strong>Produto</strong>
      <span>Metragem</span>
      <span>Consumo</span>
      <span>Calculado</span>
      <span>Venda</span>
      <span>Embalagem</span>
      <span>Valor</span>
    `;
    elements.productSummaryList.appendChild(header);

    totals.productTotals.forEach((product) => {
      const row = document.createElement('div');
      row.className = 'product-summary-item';
      row.innerHTML = `
        <strong>${escapeHtml(product.name)}</strong>
        <span>${formatArea(product.area)}</span>
        <span>${formatQuantity(product.consumption, product.unit)}/m2</span>
        <span>${formatQuantity(product.calculatedQuantity, product.unit)}</span>
        <span>${formatQuantity(product.requiredKg, product.unit)}</span>
        <span>${product.packageSize > 0 ? formatQuantity(product.packageSize, product.unit) : 'Livre'}</span>
        <span>${formatMoney(product.grossValue)}</span>
      `;
      elements.productSummaryList.appendChild(row);
    });

    const total = document.createElement('div');
    total.className = 'product-summary-item product-summary-total';
    total.innerHTML = `
      <strong>Total de materiais</strong>
      <span>${formatArea(totals.totalArea)}</span>
      <span></span>
      <span></span>
      <span>${formatTotalQuantity(totals)}</span>
      <span></span>
      <span>${formatMoney(totals.grossValue)}</span>
    `;
    elements.productSummaryList.appendChild(total);
  }

  function updateUi() {
    updateProductTitles();
    elements.measurementsList.querySelectorAll('.measurement-item').forEach((item) => {
      item.dataset.productIds = JSON.stringify(Array.from(item.querySelectorAll('.product-choice-input:checked')).map((input) => input.value));
      updateMeasurementTotal(item);
    });

    const data = readFormData();
    const totals = calculateBudget(data);

    elements.totalAreaDisplay.textContent = formatArea(totals.totalArea);
    elements.summaryArea.textContent = formatArea(totals.totalArea);
    elements.summaryKg.textContent = formatTotalQuantity(totals);
    elements.summaryGross.textContent = formatMoney(totals.grossValue);
    elements.summaryDiscount.textContent = formatMoney(totals.discountValue);
    elements.summaryFinal.textContent = formatMoney(totals.finalValue);

    elements.previewClient.textContent = data.clientName || 'Cliente nao informado';
    elements.previewJob.textContent = data.jobName || 'Nao informada';
    elements.previewProduct.textContent = data.products.filter((product) => product.name).length || 'Nenhum produto';
    elements.previewArea.textContent = formatArea(totals.totalArea);
    elements.previewKg.textContent = formatTotalQuantity(totals);
    elements.previewFinal.textContent = formatMoney(totals.finalValue);
    updateProductSummary(totals);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function productNameMap(products) {
    return products.reduce((map, product) => {
      map[product.id] = product.name || 'Produto sem nome';
      return map;
    }, {});
  }

  function buildMeasurementRows(data) {
    if (!data.measurements.length) return '<tr><td colspan="5">Nenhuma medicao cadastrada.</td></tr>';
    const names = productNameMap(data.products);
    return data.measurements.map((item) => {
      const width = toNumber(item.width);
      const height = toNumber(item.height);
      const products = (item.productIds || []).map((id) => names[id]).filter(Boolean).join(', ') || 'Nenhum produto marcado';
      return `<tr><td>${escapeHtml(item.name || 'Area')}</td><td>${formatDecimal(width)} m</td><td>${formatDecimal(height)} m</td><td>${formatArea(width * height)}</td><td>${escapeHtml(products)}</td></tr>`;
    }).join('');
  }

  function buildProductRows(totals) {
    if (!totals.productTotals.length) return '<tr><td colspan="9">Nenhum produto cadastrado.</td></tr>';
    const rows = totals.productTotals.map((product) => {
      const packageLabel = product.packageSize > 0 ? formatQuantity(product.packageSize, product.unit) : 'Livre';
      return `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.application)}</td><td>${formatArea(product.area)}</td><td>${formatQuantity(product.consumption, product.unit)}/m2</td><td>${formatQuantity(product.calculatedQuantity, product.unit)}</td><td>${packageLabel}</td><td>${formatQuantity(product.requiredKg, product.unit)}</td><td>${formatMoney(product.price)}</td><td>${formatMoney(product.grossValue)}</td></tr>`;
    }).join('');
    const totalRow = `<tr class="table-total"><td colspan="6"><strong>Total de venda</strong></td><td><strong>${formatTotalQuantity(totals)}</strong></td><td></td><td><strong>${formatMoney(totals.grossValue)}</strong></td></tr>`;
    return rows + totalRow;
  }

  function printPdf() {
    const data = readFormData();
    const totals = calculateBudget(data);
    saveData();

    const pdfWindow = window.open('', '_blank');
    if (!pdfWindow) {
      alert('Permita pop-ups para gerar o PDF do orcamento.');
      return;
    }

    const address = [data.jobAddress, data.jobDistrict, data.jobCity].filter(Boolean).join(' - ');
    const logoUrl = new URL('logo2.jpg', window.location.href).href;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orcamento Revest House Obras Beta</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#172018;margin:0;padding:30px;background:#fff} h1,h2,p{margin-top:0} .top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #1f6b3a;padding-bottom:18px;margin-bottom:22px}.brand{display:flex;align-items:center;gap:14px}.brand img{width:150px;height:auto}.brand h1{font-size:30px;margin-bottom:6px}.brand p,.meta p{color:#5f6b61;margin:4px 0}.box{border:1px solid #d8dfd4;border-radius:8px;padding:14px;margin-bottom:16px;break-inside:avoid}h2{font-size:18px;color:#1f6b3a;margin-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.line{margin:0 0 6px}.label{font-weight:700;color:#5f6b61}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;border-bottom:1px solid #d8dfd4;padding:9px 7px;vertical-align:top}th{background:#eef4eb}.table-total td{background:#eef4eb}.totals{display:grid;grid-template-columns:1fr 1fr;gap:10px}.total-final{background:#173f29;color:white;border-radius:8px;padding:14px}.total-final strong{font-size:24px}.signature{margin-top:34px;border-top:1px solid #172018;padding-top:10px;width:320px}@media print{body{padding:0}.no-print{display:none}}
    </style></head><body>
      <section class="top"><div class="brand"><img src="${logoUrl}" alt="Revest House"><div><h1>Revest House Obras Beta</h1><p>Orcamento de materiais e aplicacao</p></div></div><div class="meta"><p><span class="label">Data:</span> ${escapeHtml(data.budgetDate || '')}</p><p><span class="label">Vendedor:</span> ${escapeHtml(data.sellerName || '')}</p><p><span class="label">Contato:</span> ${escapeHtml(data.sellerWhatsapp || data.sellerEmail || '')}</p></div></section>
      <section class="box"><h2>Cliente</h2><div class="grid"><p class="line"><span class="label">Nome:</span> ${escapeHtml(data.clientName)}</p><p class="line"><span class="label">WhatsApp:</span> ${escapeHtml(data.clientWhatsapp)}</p><p class="line"><span class="label">E-mail:</span> ${escapeHtml(data.clientEmail)}</p><p class="line"><span class="label">CPF/CNPJ:</span> ${escapeHtml(data.clientDocument)}</p></div><p class="line"><span class="label">Observacoes:</span> ${escapeHtml(data.clientNotes)}</p></section>
      <section class="box"><h2>Obra</h2><div class="grid"><p class="line"><span class="label">Nome:</span> ${escapeHtml(data.jobName)}</p><p class="line"><span class="label">Tipo:</span> ${escapeHtml(data.jobType)}</p></div><p class="line"><span class="label">Endereco:</span> ${escapeHtml(address)}</p></section>
      <section class="box"><h2>Materiais</h2><table><thead><tr><th>Produto</th><th>Aplicacao</th><th>Metragem</th><th>Consumo</th><th>Calculado</th><th>Embalagem</th><th>Venda</th><th>Preco/un.</th><th>Valor</th></tr></thead><tbody>${buildProductRows(totals)}</tbody></table></section>
      <section class="box"><h2>Medicoes</h2><table><thead><tr><th>Area</th><th>Largura</th><th>Altura</th><th>Metragem</th><th>Produtos</th></tr></thead><tbody>${buildMeasurementRows(data)}</tbody></table></section>
      <section class="box"><h2>Total com desconto</h2><div class="totals"><p class="line"><span class="label">Area total:</span> ${formatArea(totals.totalArea)}</p><p class="line"><span class="label">Quantidade de venda:</span> ${formatTotalQuantity(totals)}</p><p class="line"><span class="label">Valor bruto:</span> ${formatMoney(totals.grossValue)}</p><p class="line"><span class="label">Desconto:</span> ${formatMoney(totals.discountValue)}</p></div><div class="total-final"><span>Valor final</span><br><strong>${formatMoney(totals.finalValue)}</strong></div></section>
      <section class="box"><h2>Observacoes comerciais</h2><p>${escapeHtml(data.commercialNotes)}</p></section>
      <div class="signature"><strong>${escapeHtml(data.sellerName || 'Revest House')}</strong><br>${escapeHtml(data.sellerWhatsapp || '')}<br>${escapeHtml(data.sellerEmail || '')}</div>
      <button class="no-print" onclick="window.print()" style="margin-top:24px;min-height:44px;padding:0 18px">Imprimir / Salvar PDF</button>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
    </body></html>`;

    pdfWindow.document.open();
    pdfWindow.document.write(html);
    pdfWindow.document.close();
  }

  function resetBudget() {
    saveData();
    const data = defaultData();
    const record = createBudgetRecord(data);
    currentBudgetId = record.id;
    const budgets = getSavedBudgets();
    budgets.push(record);
    setSavedBudgets(budgets);
    localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    writeFormData(data);
    renderSavedBudgets();
    saveData();
  }

  function loadSelectedBudget() {
    const selectedId = elements.savedBudgetsSelect.value;
    if (!selectedId || selectedId === currentBudgetId) return;
    saveCurrentBudgetSilently();
    currentBudgetId = selectedId;
    localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    writeFormData(loadData());
    renderSavedBudgets();
  }

  function deleteSelectedBudget() {
    const selectedId = elements.savedBudgetsSelect.value;
    const budgets = getSavedBudgets();
    if (budgets.length <= 1 || !selectedId) return;
    const selected = budgets.find((budget) => budget.id === selectedId);
    if (!confirm(`Deseja excluir o pedido "${selected?.title || 'selecionado'}"?`)) return;

    const remaining = budgets.filter((budget) => budget.id !== selectedId);
    setSavedBudgets(remaining);
    currentBudgetId = remaining[0].id;
    localStorage.setItem(CURRENT_BUDGET_KEY, currentBudgetId);
    writeFormData(remaining[0].data);
    renderSavedBudgets();
  }

  elements.form.addEventListener('input', (event) => {
    if (event.target.closest('.budget-manager')) return;
    if (event.target.closest('.sellers-panel')) {
      updateSellerTitles();
      saveSellers();
      return;
    }
    if (event.target.classList.contains('product-name')) renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.form.addEventListener('change', (event) => {
    if (event.target.closest('.budget-manager')) return;
    if (event.target.closest('.sellers-panel')) {
      saveSellers();
      return;
    }
    updateUi();
    saveData();
  });

  elements.addProductBtn.addEventListener('click', () => {
    addProduct(emptyProduct());
    renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.productsList.addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-product')) return;
    const products = elements.productsList.querySelectorAll('.product-item');
    if (products.length === 1) {
      const item = products[0];
      item.querySelectorAll('input, textarea').forEach((input) => { input.value = ''; });
    } else {
      const productId = event.target.closest('.product-item').dataset.productId;
      event.target.closest('.product-item').remove();
      elements.measurementsList.querySelectorAll('.measurement-item').forEach((measurement) => {
        const selected = JSON.parse(measurement.dataset.productIds || '[]').filter((id) => id !== productId);
        measurement.dataset.productIds = JSON.stringify(selected);
      });
    }
    renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.addSellerBtn.addEventListener('click', () => {
    if (focusEmptySellerCard()) return;
    addSeller(emptySeller());
    const sellers = elements.sellersList.querySelectorAll('.seller-item');
    const lastSeller = sellers[sellers.length - 1];
    lastSeller.querySelector('.saved-seller-name').focus();
    lastSeller.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  elements.applySellerBtn.addEventListener('click', applySelectedSeller);
  elements.sellerSelect.addEventListener('change', applySelectedSeller);

  elements.sellersList.addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-seller')) return;
    const sellers = elements.sellersList.querySelectorAll('.seller-item');
    if (sellers.length === 1) {
      const item = sellers[0];
      item.querySelectorAll('input').forEach((input) => { input.value = ''; });
    } else {
      event.target.closest('.seller-item').remove();
    }
    saveSellers();
  });

  elements.measurementsList.addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-measurement')) return;
    const items = elements.measurementsList.querySelectorAll('.measurement-item');
    if (items.length === 1) {
      const item = items[0];
      item.querySelector('.measurement-name').value = '';
      item.querySelector('.measurement-width').value = '';
      item.querySelector('.measurement-height').value = '';
      item.dataset.productIds = '[]';
    } else {
      event.target.closest('.measurement-item').remove();
    }
    renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.addMeasurementBtn.addEventListener('click', () => {
    addMeasurement(emptyMeasurement([]));
    renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.saveBtn.addEventListener('click', () => {
    saveData();
    elements.saveBtn.textContent = 'Salvo';
    setTimeout(() => { elements.saveBtn.textContent = 'Salvar'; }, 1200);
  });

  elements.newBudgetBtn.addEventListener('click', resetBudget);
  elements.loadBudgetBtn.addEventListener('click', loadSelectedBudget);
  elements.savedBudgetsSelect.addEventListener('change', () => {});
  elements.deleteBudgetBtn.addEventListener('click', deleteSelectedBudget);
  elements.pdfBtn.addEventListener('click', printPdf);

  initializeBudgetStorage();
  renderSellers();
  writeFormData(loadData());
  renderSavedBudgets();
})();
