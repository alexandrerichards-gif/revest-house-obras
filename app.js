(function () {
  'use strict';

  const STORAGE_KEY = 'revest-house-obras-budget-v1';
  const { calculateBudget, toNumber, round2 } = window.RevestHouseCalculator;

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
  elements.newBudgetBtn = document.getElementById('newBudgetBtn');
  elements.saveBtn = document.getElementById('saveBtn');
  elements.pdfBtn = document.getElementById('pdfBtn');
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

  function formatMoney(value) {
    return moneyFormatter.format(round2(value));
  }

  function emptyProduct() {
    return {
      id: createId('product'),
      name: '',
      application: '',
      consumption: '',
      price: '',
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

  function migrateData(data) {
    const merged = { ...defaultData(), ...(data || {}) };

    if (!Array.isArray(merged.products)) {
      const migratedProduct = {
        id: createId('product'),
        name: data?.productName || '',
        application: data?.productApplication || '',
        consumption: data?.productConsumption || '',
        price: data?.productPrice || '',
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
      consumption: item.querySelector('.product-consumption').value,
      price: item.querySelector('.product-price').value,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readFormData()));
  }

  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultData();
    } catch (error) {
      return defaultData();
    }
  }

  function addProduct(product) {
    const data = product || emptyProduct();
    const clone = elements.productTemplate.content.firstElementChild.cloneNode(true);
    clone.dataset.productId = data.id;
    clone.querySelector('.product-name').value = data.name || '';
    clone.querySelector('.product-application').value = data.application || '';
    clone.querySelector('.product-consumption').value = data.consumption || '';
    clone.querySelector('.product-price').value = data.price || '';
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
      <span>Quantidade</span>
      <span>Preco/kg</span>
      <span>Valor</span>
    `;
    elements.productSummaryList.appendChild(header);

    totals.productTotals.forEach((product) => {
      const row = document.createElement('div');
      row.className = 'product-summary-item';
      row.innerHTML = `
        <strong>${escapeHtml(product.name)}</strong>
        <span>${formatArea(product.area)}</span>
        <span>${formatKg(product.consumption)}/m2</span>
        <span>${formatKg(product.requiredKg)}</span>
        <span>${formatMoney(product.price)}</span>
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
      <span>${formatKg(totals.requiredKg)}</span>
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
    elements.summaryKg.textContent = formatKg(totals.requiredKg);
    elements.summaryGross.textContent = formatMoney(totals.grossValue);
    elements.summaryDiscount.textContent = formatMoney(totals.discountValue);
    elements.summaryFinal.textContent = formatMoney(totals.finalValue);

    elements.previewClient.textContent = data.clientName || 'Cliente nao informado';
    elements.previewJob.textContent = data.jobName || 'Nao informada';
    elements.previewProduct.textContent = data.products.filter((product) => product.name).length || 'Nenhum produto';
    elements.previewArea.textContent = formatArea(totals.totalArea);
    elements.previewKg.textContent = formatKg(totals.requiredKg);
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
    if (!totals.productTotals.length) return '<tr><td colspan="7">Nenhum produto cadastrado.</td></tr>';
    const rows = totals.productTotals.map((product) => {
      return `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.application)}</td><td>${formatArea(product.area)}</td><td>${formatKg(product.consumption)}/m2</td><td>${formatKg(product.requiredKg)}</td><td>${formatMoney(product.price)}</td><td>${formatMoney(product.grossValue)}</td></tr>`;
    }).join('');
    const totalRow = `<tr class="table-total"><td colspan="4"><strong>Total de materiais</strong></td><td><strong>${formatKg(totals.requiredKg)}</strong></td><td></td><td><strong>${formatMoney(totals.grossValue)}</strong></td></tr>`;
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
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orcamento Revest House Obras 1.0</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#172018;margin:0;padding:30px;background:#fff} h1,h2,p{margin-top:0} .top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #1f6b3a;padding-bottom:18px;margin-bottom:22px}.brand h1{font-size:30px;margin-bottom:6px}.brand p,.meta p{color:#5f6b61;margin:4px 0}.box{border:1px solid #d8dfd4;border-radius:8px;padding:14px;margin-bottom:16px;break-inside:avoid}h2{font-size:18px;color:#1f6b3a;margin-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.line{margin:0 0 6px}.label{font-weight:700;color:#5f6b61}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;border-bottom:1px solid #d8dfd4;padding:9px 7px;vertical-align:top}th{background:#eef4eb}.table-total td{background:#eef4eb}.totals{display:grid;grid-template-columns:1fr 1fr;gap:10px}.total-final{background:#173f29;color:white;border-radius:8px;padding:14px}.total-final strong{font-size:24px}.signature{margin-top:34px;border-top:1px solid #172018;padding-top:10px;width:320px}@media print{body{padding:0}.no-print{display:none}}
    </style></head><body>
      <section class="top"><div class="brand"><h1>Revest House Obras 1.0</h1><p>Orcamento de materiais e aplicacao</p></div><div class="meta"><p><span class="label">Data:</span> ${escapeHtml(data.budgetDate || '')}</p><p><span class="label">Vendedor:</span> ${escapeHtml(data.sellerName || '')}</p><p><span class="label">Contato:</span> ${escapeHtml(data.sellerWhatsapp || data.sellerEmail || '')}</p></div></section>
      <section class="box"><h2>Cliente</h2><div class="grid"><p class="line"><span class="label">Nome:</span> ${escapeHtml(data.clientName)}</p><p class="line"><span class="label">WhatsApp:</span> ${escapeHtml(data.clientWhatsapp)}</p><p class="line"><span class="label">E-mail:</span> ${escapeHtml(data.clientEmail)}</p><p class="line"><span class="label">CPF/CNPJ:</span> ${escapeHtml(data.clientDocument)}</p></div><p class="line"><span class="label">Observacoes:</span> ${escapeHtml(data.clientNotes)}</p></section>
      <section class="box"><h2>Obra</h2><div class="grid"><p class="line"><span class="label">Nome:</span> ${escapeHtml(data.jobName)}</p><p class="line"><span class="label">Tipo:</span> ${escapeHtml(data.jobType)}</p></div><p class="line"><span class="label">Endereco:</span> ${escapeHtml(address)}</p></section>
      <section class="box"><h2>Materiais</h2><table><thead><tr><th>Produto</th><th>Aplicacao</th><th>Metragem</th><th>Consumo</th><th>Quantidade</th><th>Preco/kg</th><th>Valor</th></tr></thead><tbody>${buildProductRows(totals)}</tbody></table></section>
      <section class="box"><h2>Medicoes</h2><table><thead><tr><th>Area</th><th>Largura</th><th>Altura</th><th>Metragem</th><th>Produtos</th></tr></thead><tbody>${buildMeasurementRows(data)}</tbody></table></section>
      <section class="box"><h2>Total com desconto</h2><div class="totals"><p class="line"><span class="label">Area total:</span> ${formatArea(totals.totalArea)}</p><p class="line"><span class="label">Quantidade total:</span> ${formatKg(totals.requiredKg)}</p><p class="line"><span class="label">Valor bruto:</span> ${formatMoney(totals.grossValue)}</p><p class="line"><span class="label">Desconto:</span> ${formatMoney(totals.discountValue)}</p></div><div class="total-final"><span>Valor final</span><br><strong>${formatMoney(totals.finalValue)}</strong></div></section>
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
    if (!confirm('Deseja iniciar um novo orcamento e limpar os dados atuais?')) return;
    localStorage.removeItem(STORAGE_KEY);
    writeFormData(defaultData());
    saveData();
  }

  elements.form.addEventListener('input', (event) => {
    if (event.target.classList.contains('product-name')) renderAllProductChoices();
    updateUi();
    saveData();
  });

  elements.form.addEventListener('change', () => {
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
  elements.pdfBtn.addEventListener('click', printPdf);

  writeFormData(loadData());
})();
