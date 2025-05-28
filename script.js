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

    // Function to parse CSV
    async function parseCSV(file) {
        try {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) {
                console.warn(`CSV file ${file} is empty or contains no data.`);
                return [];
            }
            const headers = lines[0].split(',').map(header => header.trim());
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(value => value.trim());
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        // Attempt to convert to number if applicable, otherwise keep as string
                        const val = values[index];
                        if (['Conversions', 'Spam', 'Unqualified Leads', 'Qualified Leads', 'Cost', 'Contracts Signed'].includes(header)) {
                            row[header] = parseFloat(val) || 0;
                        } else {
                            row[header] = val;
                        }
                    });
                    data.push(row);
                } else {
                    console.warn(`Skipping malformed row in ${file}: "${lines[i]}"`);
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
        // Note: qualifiedContractsData is not filtered by date in this setup,
        // as it's a separate table of specific events. If needed, add similar filtering.
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

