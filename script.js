document.addEventListener('DOMContentLoaded', () => {
    console.log("Script started. DOMContentLoaded event listener added.");

    let allRawData = []; // Stores raw event-level data from master_data.csv for the table
    let dailyAggregatedData = []; // Stores daily aggregated data for charts
    let qualifiedContractsData = []; // Stores data from qualified_contracts.csv
    let uniqueCompanyNames = new Set(); // To populate company dropdown

    let dataTableInstance;
    let contractsTableInstance;

    const combinedMetricsChartDiv = document.getElementById('combinedMetricsChart');
    const costChartDiv = document.getElementById('costChart');
    const leadStatusChartDiv = document.getElementById('leadStatusChart'); // New chart div
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
        console.log(`parseCSV called for file: ${file}`);
        try {
            const response = await fetch(file);
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status} for file: ${file}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            console.log(`Raw CSV text length for ${file}: ${text.length}`);

            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            console.log(`Number of lines parsed for ${file}: ${lines.length}`);

            if (lines.length === 0) {
                console.warn(`CSV file ${file} is empty or contains no data.`);
                return [];
            }

            const CSV_SPLIT_REGEX = /(?:"(?:""|[^"])*"|[^,]*)/g;

            const headerLineMatch = lines[0].match(CSV_SPLIT_REGEX);
            if (!headerLineMatch) {
                console.error(`Could not parse headers for file: ${file}. Line: "${lines[0]}"`);
                return [];
            }
            const headers = headerLineMatch.map(header =>
                header.startsWith('"') && header.endsWith('"')
                    ? header.substring(1, header.length - 1).replace(/""/g, '"').trim()
                    : header.trim()
            );
            console.log(`Headers for ${file}:`, headers);

            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const rawValues = lines[i].match(CSV_SPLIT_REGEX);

                if (!rawValues || rawValues.every(val => val.trim() === '')) {
                    continue;
                }

                const values = rawValues.map(value =>
                    value && value.startsWith('"') && value.endsWith('"')
                        ? value.substring(1, value.length - 1).replace(/""/g, '"').trim()
                        : (value ? value.trim() : '')
                );

                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        const val = values[index];
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
            console.log(`Number of data rows parsed for ${file}: ${data.length}`);
            if (data.length > 0) {
                console.log(`First data row for ${file}:`, data[0]);
            }
            console.log(`End of parseCSV for file: ${file}`);
            return data;
        } catch (error) {
            console.error(`Critical error loading or parsing ${file}:`, error);
            return [];
        }
    }

    // Function to aggregate raw data into daily totals for charts
    function aggregateDailyData(rawData) {
        const aggregated = {};
        rawData.forEach(row => {
            const date = row.Date;
            if (!aggregated[date]) {
                aggregated[date] = {
                    Date: date,
                    Conversions: 0,
                    Spam: 0,
                    'Unqualified Leads': 0,
                    'Qualified Leads': 0,
                    Cost: 0,
                    'Contracts Signed': 0
                };
            }
            aggregated[date].Conversions += row.Conversions;
            aggregated[date].Spam += row.Spam;
            aggregated[date]['Unqualified Leads'] += row['Unqualified Leads'];
            aggregated[date]['Qualified Leads'] += row['Qualified Leads'];
            aggregated[date].Cost += row.Cost;
            aggregated[date]['Contracts Signed'] += row['Contracts Signed'];
        });
        const result = Object.values(aggregated);
        result.sort((a, b) => new Date(a.Date) - new Date(b.Date));
        return result;
    }

    // Function to process lead status overview data
    function processLeadStatusOverview(aggregatedData) {
        let totalSpam = 0;
        let totalUnqualified = 0;
        let totalQualified = 0;
        let totalContractsSigned = 0;

        aggregatedData.forEach(row => {
            totalSpam += row.Spam;
            totalUnqualified += row['Unqualified Leads'];
            totalQualified += row['Qualified Leads'];
            totalContractsSigned += row['Contracts Signed'];
        });

        return [
            { status: 'Spam Leads', count: totalSpam },
            { status: 'Unqualified Leads', count: totalUnqualified },
            { status: 'Qualified Leads', count: totalQualified },
            { status: 'Contracts Signed', count: totalContractsSigned }
        ];
    }


    // Function to load all data from the master CSVs
    async function loadAllData() {
        console.log("loadAllData called. Attempting to parse CSVs...");
        allRawData = await parseCSV('master_data.csv');
        qualifiedContractsData = await parseCSV('qualified_contracts.csv');

        // Aggregate raw data for charting purposes
        dailyAggregatedData = aggregateDailyData(allRawData);

        console.log("Data loaded:");
        console.log("  allRawData (length, first row):", allRawData.length, allRawData.length > 0 ? allRawData[0] : 'N/A');
        console.log("  dailyAggregatedData (length, first row):", dailyAggregatedData.length, dailyAggregatedData.length > 0 ? dailyAggregatedData[0] : 'N/A');
        console.log("  qualifiedContractsData (length, first row):", qualifiedContractsData.length, qualifiedContractsData.length > 0 ? qualifiedContractsData[0] : 'N/A');

        // Extract unique company names for the dropdown
        uniqueCompanyNames.clear();
        qualifiedContractsData.forEach(row => {
            if (row['Company Name'] && row['Company Name'] !== 'N/A') {
                row['Company Name'].split(',').forEach(company => {
                    uniqueCompanyNames.add(company.trim());
                });
            }
        });
        allRawData.forEach(row => { // Use allRawData for company names
            if (row['Company Name'] && row['Company Name'] !== 'N/A') {
                 row['Company Name'].split(',').forEach(company => {
                    uniqueCompanyNames.add(company.trim());
                });
            }
        });
        console.log("Unique company names extracted:", Array.from(uniqueCompanyNames).length);


        populateCompanyDropdown();
        console.log("Populating tables...");
        populateTables(allRawData, qualifiedContractsData); // Populate main table with raw data
        console.log("Updating charts...");
        updateCharts(dailyAggregatedData); // Update charts with aggregated data
        updateLeadStatusChart(dailyAggregatedData); // Update the new lead status chart
        console.log("loadAllData finished.");
    }

    // Function to populate DataTables
    function populateTables(data, contractsData) {
        if (dataTableInstance) {
            dataTableInstance.destroy();
        }
        if (contractsTableInstance) {
            contractsTableInstance.destroy();
        }

        // Populate main data table with raw event-level data
        const tableBody = document.querySelector('#dataTable tbody');
        tableBody.innerHTML = '';
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

        dataTableInstance = new DataTable('#dataTable', {
            order: [[0, 'desc']],
            paging: true,
            searching: true,
            info: true
        });

        // Populate qualified contracts table
        const contractsTableBody = document.querySelector('#contractsTable tbody');
        contractsTableBody.innerHTML = '';
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

        contractsTableInstance = new DataTable('#contractsTable', {
            order: [[0, 'desc']],
            paging: true,
            searching: true,
            info: true
        });
        console.log("Tables populated.");
    }

    // Function to update all charts (combined metrics, cost, and lead status)
    function updateCharts(dataToChart) { // dataToChart here is dailyAggregatedData
        console.log("updateCharts called with data length:", dataToChart.length);
        updateCombinedMetricsChart(dataToChart);
        updateCostChart(dataToChart);
        console.log("Charts updated.");
    }

    // Function to update the Combined Metrics Chart
    function updateCombinedMetricsChart(dataToChart) {
        console.log("updateCombinedMetricsChart called.");
        const dates = dataToChart.map(row => row.Date);
        const traces = [];

        selectedMetrics.forEach(metric => {
            let traceType = currentChartType;
            if (currentChartType === 'area') {
                traceType = 'scatter';
            }

            traces.push({
                x: dates,
                y: dataToChart.map(row => row[metric]),
                mode: 'lines+markers',
                type: traceType,
                name: metric,
                line: {
                    color: getColorForMetric(metric),
                    // Make Contracts Signed more prominent
                    width: metric === 'Contracts Signed' ? 3 : 1, // Thicker line
                    dash: metric === 'Contracts Signed' ? 'dot' : 'solid' // Dotted line
                },
                marker: {
                    symbol: metric === 'Contracts Signed' ? 'star' : 'circle', // Star markers
                    size: metric === 'Contracts Signed' ? 8 : 6
                },
                fill: currentChartType === 'area' ? 'tozeroy' : 'none',
                stackgroup: (metric === 'Spam' || metric === 'Unqualified Leads' || metric === 'Qualified Leads') && currentChartType === 'bar' ? 'leads' : undefined
            });

            // Debug log for Contracts Signed Y values
            if (metric === 'Contracts Signed') {
                console.log("Contracts Signed Y values for combinedMetricsChart:", dataToChart.map(row => row[metric]));
            }
        });

        const layout = {
            title: 'Key Business Metrics (Excluding Cost) Over Time',
            xaxis: { title: 'Date', type: 'date' },
            yaxis: { title: 'Value', automargin: true },
            hovermode: 'closest',
            legend: { orientation: 'h', y: -0.2 }
        };

        if (typeof Plotly !== 'undefined' && Plotly.newPlot) {
            console.log("Plotly is available. Calling newPlot for combinedMetricsChart.");
            Plotly.newPlot(combinedMetricsChartDiv, traces, layout);
        } else {
            console.error("Plotly is not available or newPlot is not a function in updateCombinedMetricsChart.");
        }
    }

    // Function to update the Cost Chart
    function updateCostChart(dataToChart) {
        console.log("updateCostChart called.");
        const dates = dataToChart.map(row => row.Date);
        const costTrace = {
            x: dates,
            y: dataToChart.map(row => row.Cost),
            mode: 'lines+markers',
            type: currentChartType,
            name: 'Cost',
            line: { color: '#9467bd' },
            fill: currentChartType === 'area' ? 'tozeroy' : 'none'
        };

        const layout = {
            title: 'Daily Cost Over Time',
            xaxis: { title: 'Date', type: 'date' },
            yaxis: { title: 'Cost (USD)', automargin: true },
            hovermode: 'closest'
        };

        if (typeof Plotly !== 'undefined' && Plotly.newPlot) {
            console.log("Plotly is available. Calling newPlot for costChart.");
            Plotly.newPlot(costChartDiv, [costTrace], layout);
        } else {
            console.error("Plotly is not available or newPlot is not a function in updateCostChart.");
        }
    }

    // Function to update the Lead Status Overview Chart
    function updateLeadStatusChart(aggregatedData) { // Use dailyAggregatedData for overall totals
        console.log("updateLeadStatusChart called.");
        const leadStatusCounts = processLeadStatusOverview(aggregatedData);

        const statuses = leadStatusCounts.map(item => item.status);
        const counts = leadStatusCounts.map(item => item.count);

        const trace = {
            x: statuses,
            y: counts,
            type: 'bar', // A bar chart is suitable for this overview
            marker: {
                color: [
                    '#ff7f0e', // Spam (orange)
                    '#2ca02c', // Unqualified (green)
                    '#d62728', // Qualified (red)
                    '#8c564b'  // Contracts Signed (brown)
                ]
            }
        };

        const layout = {
            title: 'Total Lead Pipeline Overview',
            xaxis: { title: 'Lead Status', automargin: true },
            yaxis: { title: 'Total Count', automargin: true },
            hovermode: 'closest'
        };

        if (typeof Plotly !== 'undefined' && Plotly.newPlot) {
            console.log("Plotly is available. Calling newPlot for leadStatusChart.");
            Plotly.newPlot(leadStatusChartDiv, [trace], layout);
        } else {
            console.error("Plotly is not available or newPlot is not a function in updateLeadStatusChart.");
        }
    }


    // Helper function to get a consistent color for each metric
    function getColorForMetric(metric) {
        switch (metric) {
            case 'Conversions': return '#1f77b4';
            case 'Spam': return '#ff7f0e';
            case 'Unqualified Leads': return '#2ca02c';
            case 'Qualified Leads': return '#d62728';
            case 'Cost': return '#9467bd';
            case 'Contracts Signed': return '#8c564b';
            default: return '#7f7f7f';
        }
    }

    // Event listener for date filter
    document.getElementById('applyFilter').addEventListener('click', () => {
        console.log("Apply Filter button clicked.");
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        // Filter raw data for the table
        let filteredRawData = allRawData;
        if (startDate && endDate) {
            filteredRawData = allRawData.filter(row => {
                const rowDate = new Date(row.Date);
                return rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
            });
        }
        console.log("Filtered raw data length for table:", filteredRawData.length);
        populateTables(filteredRawData, qualifiedContractsData); // Update table with filtered raw data

        // Filter and re-aggregate data for charts
        let filteredAggregatedData = dailyAggregatedData;
        if (startDate && endDate) {
            filteredAggregatedData = dailyAggregatedData.filter(row => {
                const rowDate = new Date(row.Date);
                return rowDate >= new Date(startDate) && rowDate <= new Date(endDate);
            });
        }
        console.log("Filtered aggregated data length for charts:", filteredAggregatedData.length);
        updateCharts(filteredAggregatedData);
        // Lead status chart is overall, not filtered by date, but re-render if data changes
        updateLeadStatusChart(dailyAggregatedData); // Use full aggregated data for overall view
    });

    // Event listener for metric toggles
    metricToggles.forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const metric = event.target.dataset.metric;
            console.log(`Metric toggle changed: ${metric} to ${event.target.checked}`);
            if (event.target.checked) {
                if (!selectedMetrics.includes(metric)) {
                    selectedMetrics.push(metric);
                }
            } else {
                selectedMetrics = selectedMetrics.filter(m => m !== metric);
            }
            updateCombinedMetricsChart(dailyAggregatedData); // Update combined chart with aggregated data
        });
    });

    // Event listener for chart type selection
    chartTypeSelect.addEventListener('change', (event) => {
        currentChartType = event.target.value;
        console.log("Chart type changed to:", currentChartType);
        updateCharts(dailyAggregatedData); // Update both time-series charts with new type
    });

    // Populate Company Dropdown
    function populateCompanyDropdown() {
        console.log("Populating company dropdown.");
        newContractCompanySelect.innerHTML = '<option value="">-- Select Company --</option>';
        const sortedCompanies = Array.from(uniqueCompanyNames).sort();
        sortedCompanies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            newContractCompanySelect.appendChild(option);
        });
        console.log("Company dropdown populated with", sortedCompanies.length, "companies.");
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
            console.log("Switched to new company text input.");
        } else {
            newContractCompanySelect.style.display = 'block';
            newContractCompanyTextInput.style.display = 'none';
            newContractCompanyTextInput.removeAttribute('required');
            newContractCompanySelect.setAttribute('required', 'true');
            toggleCompanyInputButton.textContent = 'Enter New Company';
            console.log("Switched to existing company select dropdown.");
        }
    });


    // Add New Daily Data functionality (client-side only)
    addDailyDataForm.addEventListener('submit', (event) => {
        event.preventDefault();
        console.log("Add Daily Data form submitted.");

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

        allRawData.push(newEntry);
        allRawData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        // Re-aggregate data for charts
        dailyAggregatedData = aggregateDailyData(allRawData);

        // Update tables and charts
        populateTables(allRawData, qualifiedContractsData); // Table with raw data
        updateCharts(dailyAggregatedData); // Time-series charts with aggregated data
        updateLeadStatusChart(dailyAggregatedData); // Lead status chart with aggregated data

        addDailyDataForm.reset();
        console.log("New daily data added:", newEntry);
    });

    // Add New Contract functionality (client-side only)
    addContractForm.addEventListener('submit', (event) => {
        event.preventDefault();
        console.log("Add Contract form submitted.");

        const selectedCompany = newContractCompanySelect.style.display !== 'none'
                                ? newContractCompanySelect.value
                                : newContractCompanyTextInput.value;

        if (!selectedCompany) {
            alert("Please select or enter a Company Name.");
            console.warn("Company name not selected/entered for new contract.");
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

        populateTables(allRawData, qualifiedContractsData); // Update main table (using raw data) and contracts table

        // Add new company to dropdown if it's a new entry
        if (selectedCompany && !uniqueCompanyNames.has(selectedCompany)) {
            uniqueCompanyNames.add(selectedCompany);
            populateCompanyDropdown();
        }

        addContractForm.reset();
        newContractCompanyTextInput.style.display = 'none';
        newContractCompanySelect.style.display = 'block';
        toggleCompanyInputButton.textContent = 'Enter New Company';
        newContractCompanySelect.setAttribute('required', 'true');
        newContractCompanyTextInput.removeAttribute('required');
        console.log("New contract added:", newContract);
    });


    // Initial data load when the page is ready
    loadAllData();
});
