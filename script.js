document.addEventListener('DOMContentLoaded', () => {
    let allData = []; // Stores data from master_data.csv
    let qualifiedContractsData = []; // Stores data from qualified_contracts.csv
    let dataTableInstance;
    let contractsTableInstance;

    const combinedChartDiv = document.getElementById('combinedChart');
    const metricToggles = document.querySelectorAll('.chart-metric-toggle');
    const availableMetrics = ['Conversions', 'Spam', 'Unqualified Leads', 'Qualified Leads', 'Cost', 'Contracts Signed'];
    let selectedMetrics = availableMetrics.filter(metric => {
        const checkbox = document.querySelector(`.chart-metric-toggle[data-metric="${metric}"]`);
        return checkbox ? checkbox.checked : false;
    });

    // Function to parse CSV more robustly
    async function parseCSV(file) {
        try {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            // Use split(/\r?\n/) to handle both Windows (\r\n) and Unix (\n) line endings
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length === 0) {
                console.warn(`CSV file ${file} is empty or contains no data.`);
                return [];
            }

            // Regex for CSV splitting:
            // It captures either:
            // 1. A double-quoted field: "(?:""|[^"])*" (allows "" for escaped quotes)
            // 2. Or, a sequence of non-comma characters: [^,]* (for unquoted fields)
            // The `g` flag ensures all matches are found.
            const CSV_SPLIT_REGEX = /(?:"(?:""|[^"])*"|[^,]*)/g;

            // Extract headers and clean them (remove outer quotes, unescape inner quotes, trim)
            const headers = lines[0].match(CSV_SPLIT_REGEX).map(header =>
                header.startsWith('"') && header.endsWith('"')
                    ? header.substring(1, header.length - 1).replace(/""/g, '"').trim()
                    : header.trim()
            );

            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const rawValues = lines[i].match(CSV_SPLIT_REGEX);

                if (!rawValues || rawValues.every(val => val.trim() === '')) { // Check for completely empty rows from regex
                    console.warn(`Skipping empty or invalid row (no meaningful matches) in ${file}: "${lines[i]}"`);
                    continue;
                }

                // Clean up captured values: remove outer quotes and unescape inner quotes
                const values = rawValues.map(value =>
                    value.startsWith('"') && value.endsWith('"')
                        ? value.substring(1, value.length - 1).replace(/""/g, '"').trim()
                        : value.trim()
                );

                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        const val = values[index];
                        // Convert specific columns to numbers, default to 0 if parsing fails
                        if (['Conversions', 'Spam', 'Unqualified Leads', 'Qualified Leads', 'Cost', 'Contracts Signed'].includes(header)) {
                            row[header] = parseFloat(val) || 0;
                        } else {
                            row[header] = val;
                        }
                    });
                    data.push(row);
                } else {
                    console.warn(`Skipping malformed row (column count mismatch) in ${file}: "${lines[i]}" - Expected ${headers.length}, got ${values.length}. Raw values: [${rawValues.join(', ')}]`);
                }
            }
            return data;
        } catch (error) {
            console.error(`Error loading or parsing ${file}:`, error);
            return [];
        }
    }

    // Function to load all data from the master CSVs
    async function loadAllData() {
        allData = await parseCSV('master_data.csv');
        qualifiedContractsData = await parseCSV('qualified_contracts.csv');

        // Sort allData by date
        allData.sort((a, b) => new Date(a.Date) - new Date(b.Date));
        qualifiedContractsData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        // Initial population and chart update
        populateTables(allData, qualifiedContractsData);
        updateCombinedChart(allData);
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

    // Function to update the combined chart
    function updateCombinedChart(dataToChart) {
        const dates = dataToChart.map(row => row.Date);
        const traces = [];

        selectedMetrics.forEach(metric => {
            traces.push({
                x: dates,
                y: dataToChart.map(row => row[metric]),
                mode: 'lines+markers',
                name: metric,
                // Assign different colors for better distinction
                line: { color: getColorForMetric(metric) }
            });
        });

        const layout = {
            title: 'Key Business Metrics Over Time',
            xaxis: { title: 'Date', type: 'date' },
            yaxis: { title: 'Value', automargin: true },
            hovermode: 'closest',
            legend: { orientation: 'h', y: -0.2 } // Horizontal legend at the bottom
        };

        Plotly.newPlot(combinedChartDiv, traces, layout);
    }

    // Helper function to get a consistent color for each metric
    function getColorForMetric(metric) {
        switch (metric) {
            case 'Conversions': return '#1f77b4'; // blue
            case 'Spam': return '#ff7f0e'; // orange
            case 'Unqualified Leads': return '#2ca02c'; // green
            case 'Qualified Leads': return '#d62728'; // red
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
        updateCombinedChart(filteredData);

        // Update DataTables directly using its API
        if (dataTableInstance) {
            // DataTables provides a search API; using that is more efficient than re-creating the table
            // This example re-populates which is fine for smaller datasets but can be optimized
            dataTableInstance.rows().remove().draw(); // Clear existing rows
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
            updateCombinedChart(allData); // Re-render chart with current data and new metric selection
        });
    });

    // Add New Data functionality (client-side only)
    document.getElementById('addDataForm').addEventListener('submit', (event) => {
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

        // Add new entry to allData and re-sort
        allData.push(newEntry);
        allData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        // Re-populate tables and update charts with new data
        // For simplicity, we re-load all data and regenerate tables/charts.
        // In a real application with more data, you'd update more efficiently.
        populateTables(allData, qualifiedContractsData); // Pass qualifiedContractsData as it's not affected by this form
        updateCombinedChart(allData);

        // Clear form
        event.target.reset();
    });

    // Initial data load when the page is ready
    loadAllData();
});
