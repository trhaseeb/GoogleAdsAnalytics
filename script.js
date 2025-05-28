document.addEventListener('DOMContentLoaded', () => {
    let allData = []; // Stores data from master_data.csv
    let qualifiedContractsData = []; // Stores data from qualified_contracts.csv
    let uniqueCompanyNames = new Set(); // To populate company dropdown

    let dataTableInstance;
    let contractsTableInstance;

    const combinedMetricsChartDiv = document.getElementById('combinedMetricsChart');
    const costChartDiv = document.getElementById('costChart');
    const metricToggles = document.querySelectorAll('.chart-metric-toggle');
    const chartTypeSelect = document.getElementById('chartType');
    const addDailyDataForm = document.getElementById('addDailyDataForm');
    const addContractForm = document.getElementById('addContractForm');
    const newContractCompanySelect = document.getElementById('newContractCompany');
    const newContractCompanyTextInput = document.getElementById('newContractCompanyText');
    const toggleCompanyInputButton = document.getElementById('toggleCompanyInput');


    const availableMetrics = ['Conversions', 'Spam', 'Unqualified Leads', 'Qualified Leads', 'Contracts Signed'];
    let selectedMetrics = availableMetrics.filter(metric => {
        const checkbox = document.querySelector(`.chart-metric-toggle[data-metric="${metric}"]`);
        return checkbox ? checkbox.checked : false;
    });

    let currentChartType = chartTypeSelect.value; // 'line', 'bar', 'area'

    // Function to parse CSV more robustly
    async function parseCSV(file) {
        try {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) {
                console.warn(`CSV file ${file} is empty or contains no data.`);
                return [];
            }

            const CSV_SPLIT_REGEX = /(?:"(?:""|[^"])*"|[^,]*)/g;

            const headers = lines[0].match(CSV_SPLIT_REGEX).map(header =>
                header.startsWith('"') && header.endsWith('"')
                    ? header.substring(1, header.length - 1).replace(/""/g, '"').trim()
                    : header.trim()
            );

            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const rawValues = lines[i].match(CSV_SPLIT_REGEX);

                if (!rawValues || rawValues.every(val => val.trim() === '')) {
                    continue;
                }

                const values = rawValues.map(value =>
                    value && value.startsWith('"') && value.endsWith('"')
                        ? value.substring(1, value.length - 1).replace(/""/g, '"').trim()
                        : (value ? value.trim() : '') // Handle null/undefined value
                );

                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        const val = values[index];Update ion
    }

    // Function to populate DataTables
    function populateTables(data, contractsData) {
        // Destroy existing instances if they exist
        if (dataTableInstance) {
            dataTableInstance.destroy();
        }
        if (contractsTableInstance) {
            contractsTableInstance.destroy();
        }

        // Populate main data table
        const tableBody = document.querySelector('#dataTable tbody');
        tableBody.innerHTML = ''; // Clear existing rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.Date}</td>
                <td>${row.Conversions.toFixed(2)}</td>
                <td>${row.Spam}</td>
                <td>${row['Unqualified Leads']}</td>
                <td>${row['Qualified Leads']}</td>
                <td>${row.Cost.toFixed(2)}</td>
                <td>${row['Contracts Signed']}</td>
                <td>${row['Company Name']}</td>
            `;
            tableBody.appendChild(tr);
        });

        // Initialize main DataTable
        dataTableInstance = new DataTable('#dataTable', {
            order: [[0, 'desc']], // Order by date descending by default
            paging: true,
            searching: true,
            info: true
        });

        // Populate qualified contracts table
        const contractsTableBody = document.querySelector('#contractsTable tbody');
        contractsTableBody.innerHTML = ''; // Clear existing rows
        contractsData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.Date}</td>
                <td>${row['Lead Name']}</td>
                <td>${row['Company Name']}</td>
                <td>${row['Service Type']}</td>
                <td>${row['Contract Date']}</td>
            `;
            contractsTableBody.appendChild(tr);
        });

        // Initialize contracts DataTable
        contractsTableInstance = new DataTable('#contractsTable', {
            order: [[0, 'desc']], // Order by date descending by default
            paging: true,
            searching: true,
            info: true
        });
    }

    // Function to update both charts
    function updateCharts(dataToChart) {
        updateCombinedMetricsChart(dataToChart);
        updateCostChart(dataToChart);
    }

    // Function to update the Combined Metrics Chart
    function updateCombinedMetricsChart(dataToChart) {
        const dates = dataToChart.map(row => row.Date);
        const traces = [];

        selectedMetrics.forEach(metric => {
            let traceType = currentChartType;
            if (currentChartType === 'area') { // Plotly 'area' is 'scatter' with 'fill'
                traceType = 'scatter';
            }

            traces.push({
                x: dates,
                y: dataToChart.map(row => row[metric]),
                mode: 'lines+markers', // Always show markers for clarity, can be changed
                type: traceType,
                name: metric,
                line: { color: getColorForMetric(metric) },
                fill: currentChartType === 'area' ? 'tozeroy' : 'none', // Fill for area charts
                stackgroup: (metric === 'Spam' || metric === 'Unqualified Leads' || metric === 'Qualified Leads') && currentChartType === 'bar' ? 'leads' : undefined // Stack leads if bar chart
            });
        });

        const layout = {
            title: 'Key Business Metrics (Excluding Cost) Over Time',
            xaxis: { title: 'Date', type: 'date' },
            yaxis: { title: 'Value', automargin: true },
            hovermode: 'closest',
            legend: { orientation: 'h', y: -0.2 }
        };

        Plotly.newPlot(combinedMetricsChartDiv, traces, layout);
    }

    // Function to update the Cost Chart
    function updateCostChart(dataToChart) {
        const dates = dataToChart.map(row => row.Date);
        const costTrace = {
            x: dates,
            y: dataToChart.map(row => row.Cost),
            mode: 'lines+markers',
            type: currentChartType, // Use selected chart type for cost as well
            name: 'Cost',
            line: { color: '#9467bd' }, // Consistent purple color for cost
            fill: currentChartType === 'area' ? 'tozeroy' : 'none'
        };

        const layout = {
            title: 'Daily Cost Over Time',
            xaxis: { title: 'Date', type: 'date' },
            yaxis: { title: 'Cost (USD)', automargin: true },
            hovermode: 'closest'
        };

        Plotly.newPlot(costChartDiv, [costTrace], layout);
    }


    // Helper function to get a consistent color for each metric
    function getColorForMetric(metric) {
        switch (metric) {
            case 'Conversions': return '#1f77b4'; // blue
            case 'Spam': return '#ff7f0e'; // orange
            case 'Unqualified Leads': return '#2ca02c'; // green
            case 'Qualified Leads': return '#d62728'; // red
            // Cost is handled separately, but included for completeness if ever needed here
            case 'Cost': return '#9467bd'; // purple
            case 'Contracts Signed': return '#8c564b'; // brown
            default: return '#7f7f7f'; // grey
        }
    }

    // Event listener for date filter
    document.getElementById('applyFilter').addEventListener('click', () => {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        let filteredData = allData;
        if (startDate && endDate) {
            filteredData = allData.filter(row => {
                const rowDate = new Date(row.Date);
                return rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
            });
        }
        updateCharts(filteredData);

        // Update DataTables directly using its API
        if (dataTableInstance) {
            dataTableInstance.rows().remove().draw();
            const tableData = filteredData.map(row => [
                row.Date,
                row.Conversions.toFixed(2),
                row.Spam,
                row['Unqualified Leads'],
                row['Qualified Leads'],
                row.Cost.toFixed(2),
                row['Contracts Signed'],
                row['Company Name']
            ]);
            dataTableInstance.rows.add(tableData).draw();
        }
    });

    // Event listener for metric toggles
    metricToggles.forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const metric = event.target.dataset.metric;
            if (event.target.checked) {
                if (!selectedMetrics.includes(metric)) {
                    selectedMetrics.push(metric);
                }
            } else {
                selectedMetrics = selectedMetrics.filter(m => m !== metric);
            }
            updateCombinedMetricsChart(allData); // Only update combined chart
        });
    });

    // Event listener for chart type selection
    chartTypeSelect.addEventListener('change', (event) => {
        currentChartType = event.target.value;
        updateCharts(allData); // Update both charts with new type
    });

    // Populate Company Dropdown
    function populateCompanyDropdown() {
        newContractCompanySelect.innerHTML = '<option value="">-- Select Company --</option>';
        const sortedCompanies = Array.from(uniqueCompanyNames).sort();
        sortedCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            newContractCompanySelect.appendChild(option);
        });
    }

    // Toggle Company Name input type
    toggleCompanyInputButton.addEventListener('click', () => {
        const isSelectVisible = newContractCompanySelect.style.display !== 'none';
        if (isSelectVisible) {
            newContractCompanySelect.style.display = 'none';
            newContractCompanyTextInput.style.display = 'block';
            newContractCompanyTextInput.setAttribute('required', 'true');
            newContractCompanySelect.removeAttribute('required');
            toggleCompanyInputButton.textContent = 'Select Existing Company';
        } else {
            newContractCompanySelect.style.display = 'block';
            newContractCompanyTextInput.style.display = 'none';
            newContractCompanyTextInput.removeAttribute('required');
            newContractCompanySelect.setAttribute('required', 'true');
            toggleCompanyInputButton.textContent = 'Enter New Company';
        }
    });


    // Add New Daily Data functionality (client-side only)
    addDailyDataForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const newEntry = {
            Date: document.getElementById('newDataDate').value,
            Conversions: parseFloat(document.getElementById('newDataConversions').value) || 0,
            Spam: parseInt(document.getElementById('newDataSpam').value) || 0,
            'Unqualified Leads': parseInt(document.getElementById('newDataUnqualified').value) || 0,
            'Qualified Leads': parseInt(document.getElementById('newDataQualified').value) || 0,
            Cost: parseFloat(document.getElementById('newDataCost').value) || 0,
            'Contracts Signed': parseInt(document.getElementById('newDataContracts').value) || 0,
            'Company Name': document.getElementById('newDataCompany').value || 'N/A'
        };

        allData.push(newEntry);
        allData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        populateTables(allData, qualifiedContractsData);
        updateCharts(allData);

        addDailyDataForm.reset();
    });

    // Add New Contract functionality (client-side only)
    addContractForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const selectedCompany = newContractCompanySelect.style.display !== 'none'
                                ? newContractCompanySelect.value
                                : newContractCompanyTextInput.value;

        if (!selectedCompany) {
            alert("Please select or enter a Company Name.");
            return;
        }

        const newContract = {
            Date: document.getElementById('newContractDate').value, // Lead Date
            'Lead Name': document.getElementById('newContractLeadName').value,
            'Company Name': selectedCompany,
            'Service Type': document.getElementById('newContractServiceType').value || 'N/A',
            'Contract Date': document.getElementById('newContractSignedDate').value
        };

        qualifiedContractsData.push(newContract);
        qualifiedContractsData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        // Important: If this contract adds to 'Contracts Signed' for a *new* date or increases count for an *existing* date
        // in master_data.csv, you would need to update allData as well.
        // For simplicity and client-side nature, this form ONLY updates the 'qualified_contracts' table.
        // A full integration would require logic to find/update the corresponding daily aggregate in `allData`.
        // For now, if you add a contract here and want it reflected in the daily "Contracts Signed" count,
        // you would manually adjust the "Add Daily Data" form for that date.
        // Alternatively, the prompt was for a suggestion on data entry, so we'll leave it as separate.

        populateTables(allData, qualifiedContractsData); // Re-populate to show new contract

        // Add new company to dropdown if it's a new entry
        if (selectedCompany && !uniqueCompanyNames.has(selectedCompany)) {
            uniqueCompanyNames.add(selectedCompany);
            populateCompanyDropdown();
        }

        addContractForm.reset();
        newContractCompanyTextInput.style.display = 'none'; // Hide text input after submission
        newContractCompanySelect.style.display = 'block'; // Show select again
        toggleCompanyInputButton.textContent = 'Enter New Company';
        newContractCompanySelect.setAttribute('required', 'true');
        newContractCompanyTextInput.removeAttribute('required');
    });


    // Initial data load when the page is ready
    loadAllData();
});
