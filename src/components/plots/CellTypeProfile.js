import React, { useState, useEffect, useCallback } from "react";
import atlasapprox from "@fabilab/atlasapprox";
import ImageMapper from "react-img-mapper";
import orgMeta from "../../utils/organismMetadata.js";
import { fetchWikiImage } from "../../utils/cellTypeResources/fetchImage.js";
import BubbleHeatmap from "./BubbleHeatmap";
import { scaleImage } from "../../utils/plotHelpers/scaleImage.js";
import { fetchCellTypeDescription } from "../../utils/cellTypeResources/fetchDescription.js";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Typography, Select, Table, Spin } from "antd";
import { scaleLinear } from "d3-scale";
import Plot from "react-plotly.js";

const { Option } = Select;
const { Text } = Typography;

/**
 * CellTypeProfile Component
 *
 * This component provides an interactive visualization of cell type distribution
 * across species and organs. It displays:
 * - An image and description of the selected cell type.
 * - A bar chart of cell type distribution across species and organs.
 * - An organ map when a species is selected.
 * - A table of top 10 marker genes and a bubble heatmap when an organ is selected.
 * - Log transformation support for gene expression dot plots.
 */

const CellTypeProfile = ({ state }) => {
  const { cellType, distributionData, hasLog } = state;

  const [description, setDescription] = useState(null);
  const [selectedSpecies, setSelectedSpecies] = useState("all");
  const [hoveredOrgan, setHoveredOrgan] = useState(null);
  const [wikiImage, setWikiImage] = useState(null);
  const [selectedOrganMarkers, setSelectedOrganMarkers] = useState(null);
  const [loadingMarkerPlot, setLoadingMarkerPlot] = useState(true);
  const [loadingMarker, setLoadingMarker] = useState(true);
  const [markerExpressionPlotData, setMarkerExpressionPlotData] = useState(null);
  const [distributionPlotData, setDistributionPlotData] = useState(null);
  const [distributionPlotLayout, setDistributionPlotLayout] = useState(null);
  const [scalingFactors, setScalingFactors] = useState({ width: 1, height: 1 });

  const imageUnavailableNotice = require("../../asset/imageUnavailable.png");

  /**
   * Fetches the cell type image from Wikipedia when the cellType changes.
   */
  useEffect(() => {
    setSelectedSpecies("all");
    setHoveredOrgan(null);
    setSelectedOrganMarkers(null);

    const getImage = async () => {
      const imageData = await fetchWikiImage(cellType);
      setWikiImage(imageData);
    };
    getImage();

    const getDescription = async () => {
      let cellTypeDescription = await fetchCellTypeDescription(cellType);
      setDescription(cellTypeDescription);
    };
    getDescription();
  }, [cellType]);

  /**
   * Generates a bar chart of cell type distribution across species and organs.
   */
  const makePlot = useCallback(() => {
    let d =
      selectedSpecies !== "all"
        ? distributionData.data.filter((d) => d.organism === selectedSpecies)
        : distributionData.data;

    // Aggregate total counts for each organ across species
    let total = {};
    d.forEach((species) => {
      species.organCounts.forEach(({ organ, count }) => {
        total[organ] = (total[organ] || 0) + count;
      });
    });

    const sortedOrgans = Object.entries(total)
      .sort(([, a], [, b]) => b - a)
      .map(([organ]) => organ);

    // Ensure all bars have the same width
    const barWidth = sortedOrgans.length > 2? 0.8 : 0.4;

    // Adjust chart width dynamically
    const chartWidth = sortedOrgans.length > 25 ? 40 * sortedOrgans.length : 30 * sortedOrgans.length + 500; // Increase width when x-axis has >15 items

    // Generate bar chart data
    const plotData = d.map((speciesData) => {
      const rawCount = sortedOrgans.map((organ) => {
        const organCount = speciesData.organCounts.find((count) => count.organ === organ);
        return organCount ? organCount.count : 0;
      });

      const percentages = rawCount.map((count) => (count / rawCount.reduce((sum, val) => sum + val, 0)) * 100);

      return {
        x: sortedOrgans,
        y: d.length === 1 ? percentages : rawCount,
        name: speciesData.organism,
        type: "bar",
        text: d.length === 1 ? percentages.map((p) => p.toFixed(2) + "%") : rawCount.map((c) => c.toString()),
        textposition: "auto",
        width: Array(sortedOrgans.length).fill(barWidth),
      };
    });

    const defaultLayout = {
      width: chartWidth,
      height: 450,
      barmode: "stack",
      margin: {
        r: 50,
        t: 50,
        b: 10,
      },
      xaxis: {
        title: "Tissue",
        tickangle: 45,
        automargin: true,
      },
      yaxis: {
        range: [0, d.length === 1 ? 100 : Math.max(...Object.values(total))],
      },
      plot_bgcolor: "white",
      paper_bgcolor: "white",
      font: {
        family: "Arial, sans-serif",
        size: 12,
      },
      legend: {
        x: 1,
        y: 1,
        xanchor: "right",
        yanchor: "top",
      },
      bargap: 0.05, // Controls the spacing between individual bars
      bargroupgap: 0.1
    };

    let plotLayout = { ...defaultLayout };
    if (plotData.length === 1) {
      const minCount = Math.min(...plotData[0]["y"]);
      const maxCount = Math.max(...plotData[0]["y"]);
      const colorScale = scaleLinear().domain([minCount, maxCount]).range(["#f0d2cc", "#ed4e2b"]);
      plotData[0].marker = {
        color: plotData[0].y.map((c) => colorScale(c)),
      };

      plotLayout.showlegend = false;
      plotLayout.yaxis = {
        title: "Cell percentage (%)",
        range: [0, maxCount * 1.2 > 100 ? 100 : maxCount * 1.2],
      };
      plotLayout.showlegend = true;
    } else {
      plotLayout.showlegend = true;
      plotLayout.yaxis = {
        title: "Cell Count",
        range: [0, Math.max(...Object.values(total || 0)) * 1.1],
      };
    }

    setDistributionPlotData(plotData);
    setDistributionPlotLayout(plotLayout);
  }, [selectedSpecies, distributionData.data]);

  const fetchMarkers = useCallback(
    async (organ) => {
      try {
        const marker_params = {
          organism: selectedSpecies,
          organ: organ,
          celltype: cellType,
          number: 10,
          measurement_types: "gene_expression",
        };

        let apiResponse = await atlasapprox.markers(marker_params);
        let markers = apiResponse.markers;

        apiResponse = await atlasapprox.dotplot({
          organism: selectedSpecies,
          organ: organ,
          features: markers,
          measurement_types: "gene_expression",
        });

        const cellTypeIndex = apiResponse.celltypes.indexOf(cellType);
        const expressionLevel = apiResponse.average.map((a) => a[cellTypeIndex].toFixed(2));
        const fractionDetected = apiResponse.fraction_detected.map((f) => (f[cellTypeIndex] * 100).toFixed(2) + "%");
        const combined = markers.map((gene, index) => ({
          gene,
          expression: expressionLevel[index],
          fraction: fractionDetected[index],
        }));

        return { dotPlotData: apiResponse, markerExpression: combined };
      } catch (error) {
        console.error("Error fetching markers:", error);
      }
    },
    [cellType, selectedSpecies]
  );

  const handleOrganSelect = async (area) => {
    if (area.name.includes("-label")) return;

    setHoveredOrgan(area.name);
    setLoadingMarker(true);
    setLoadingMarkerPlot(true);

    const { dotPlotData, markerExpression } = await fetchMarkers(area.name);

    setMarkerExpressionPlotData(dotPlotData);
    setLoadingMarker(false);
    setLoadingMarkerPlot(false);
    setSelectedOrganMarkers(markerExpression);
  };

  // Render organ map component
  const renderImageMap = () => {
    // If no matching data, return nothing
    const match = distributionData.data.filter((d) => d.organism === selectedSpecies);
    if (match.length === 0) {
      return <></>;
    }
    const counts = match[0].organCounts.reduce((acc, item) => {
      acc[item.organ] = item.count;
      return acc;
    }, {});

    // If only one organ, show the species's picture from './organism'
    if (Object.keys(counts).length === 1) {
      return (
        <ImageMapper
          id="organism-image"
          src={require(`../../asset/organisms/${selectedSpecies}.jpeg`)}
          width={300}
          height={300}
        />
      );
    }

    const minCount = Math.min(...Object.values(counts));
    const maxCount = Math.max(...Object.values(counts));
    const colorScale = scaleLinear().domain([minCount, maxCount]).range(["#f0d2cc", "#ed4e2b"]);

    const areas = Object.entries(orgMeta[selectedSpecies]?.organs || {}).map(([organ, metadata]) => {
      const coords = metadata.coords.split(",").map(Number);
      const adjustedCoords = coords.map((coord, index) =>
        index % 2 === 0 ? coord * scalingFactors.width : coord * scalingFactors.height
      );

      const isLabel = organ.includes("-label");
      const organColor = counts[organ] ? colorScale(counts[organ]) : "transparent";
      return {
        id: organ,
        name: organ,
        shape: metadata.shape || "poly",
        coords: adjustedCoords,
        fillColor: isLabel ? "transparent" : organColor,
        preFillColor: isLabel ? "transparent" : organColor,
        strokeColor: "transparent",
      };
    });

    let imagePathPrefix = `grey_${selectedSpecies}`;

    return (
      // eslint-disable-next-line
      <ImageMapper
        id="organism-image"
        src={require(`../../asset/anatomy/${imagePathPrefix}.jpg`)}
        map={{ name: `${selectedSpecies}-map`, areas: areas }}
        onClick={handleOrganSelect}
        width={450}
        height={450}
      />
    );
  };

  const renderColorBar = () => {
    const match = distributionData.data.filter((d) => d.organism === selectedSpecies);
    if (match.length === 0) {
      return <></>;
    }
    const counts = match[0].organCounts.reduce((acc, item) => {
      acc[item.organ] = item.count;
      return acc;
    }, {});
    if (Object.keys(counts).length === 1) {
      return <></>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "10px" }}>
        <Text>High</Text>
        <div
          style={{
            height: "100px",
            width: "20px",
            background: `linear-gradient(to bottom, #ed4e2b, #f0d2cc)`,
            margin: "10px 0",
          }}
        />
        <Text>Low</Text>
      </div>
    );
  };

  useEffect(() => {
    if (!distributionPlotData) {
      makePlot();
    }
  });

  useEffect(() => {
    setHoveredOrgan(null);
    setSelectedOrganMarkers(null);
    if (selectedSpecies === "all") {
      makePlot();
    } else {
      makePlot();
      if (orgMeta[selectedSpecies].organs) {
        const imagePathPrefix = `grey_${selectedSpecies}`;
        let imageWithDimensions = require(`../../asset/anatomy/${imagePathPrefix}.jpg`);
        scaleImage(imageWithDimensions, 450, setScalingFactors);
      }

      const fetch_data = async (organ) => {
        setHoveredOrgan(organ);
        setLoadingMarker(true);
        setLoadingMarkerPlot(true);

        const { dotPlotData, markerExpression } = await fetchMarkers(organ);

        setMarkerExpressionPlotData(dotPlotData);
        setSelectedOrganMarkers(markerExpression);
        setLoadingMarker(false);
        setLoadingMarkerPlot(false);
      };

      const match = distributionData.data.filter((d) => d.organism === selectedSpecies);
      if (match.length !== 0) {
        const counts = match[0].organCounts.reduce((acc, item) => {
          acc[item.organ] = item.count;
          return acc;
        }, {});
        if (Object.keys(counts).length === 1) {
          const organ = Object.keys(counts)[0];
          fetch_data(organ);
        }
      }
    }
  }, [selectedSpecies, makePlot, distributionData, fetchMarkers]);

  return (
    <div style={{ padding: "20px" }}>
      {/* cell type name, picture and desctiption */}
      <h1 style={{ fontSize: "24px", marginBottom: "15px", fontWeight: "bold", cursor: "pointer"}}>
      <a 
        href={`https://www.google.com/search?q=${encodeURIComponent(cellType)}`} target="_blank" rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
      >
        {cellType}
      </a>
        </h1>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <img
            src={wikiImage ? wikiImage.url : imageUnavailableNotice}
            alt={`${cellType} cell`}
            style={{ width: "120px", height: "120px", objectFit: "cover" }}
          />
        </div>
        <p style={{ fontSize: "15px", lineHeight: "1.5", flex: 1 }}>
          {description || "loading"}{" "}
          <span style={{ fontSize: "15px", color: "#888" }}>
            (Source:{" "}
            <a href="https://www.ebi.ac.uk/ols4" target="_blank" rel="noopener noreferrer" style={{ color: "#1890ff" }}>
              EBI
            </a>
            )
          </span>
        </p>
      </div>

      {/* cell type distribution bar chart */}
      <h1 style={{ fontSize: "22px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
        Cell type distribution in
        <Select defaultValue="all" style={{ width: 150 }} onChange={(value) => setSelectedSpecies(value)} value={selectedSpecies}>
          <Option value="all">All</Option>
          {distributionData.data.map((d) => (
            <Option key={d.organism} value={d.organism}>{d.organism}</Option>
          ))}
        </Select>
      </h1>
      <div style={{ marginTop: "16px", fontSize: "15px", color: "#888", display: "flex", alignItems: "center" }}>
        <InfoCircleOutlined style={{ marginRight: "8px" }} />
        <p>Choose a species from the dropdown to view the organ map.</p>
      </div>
      {distributionPlotData && distributionPlotLayout && (
        <div style={{ width: "100%", display: "flex" }}>
          <Plot data={distributionPlotData} layout={distributionPlotLayout} config={{ responsive: true, displayModeBar: false }} style={{ width: "900px", height: "450px" }} />
        </div>
      )}

      {/* organ map */}
      {selectedSpecies !== "all" && Object.keys(orgMeta[selectedSpecies]?.organs || {}).length >= 1 && (
        <>
          <h1 style={{ fontSize: "22px", marginBottom: "8px", fontWeight: "bold" }}>Organ map</h1>
          <div style={{ marginTop: "16px", fontSize: "15px", color: "#888", display: "flex", alignItems: "center" }}>
            <InfoCircleOutlined style={{ marginRight: "8px" }} />
            <p>Click an organ to view the top 10 marker genes for the cell type.</p>
          </div>
        </>
      )}
      <div style={{ padding: "0% 5%", display: "flex", justifyContent: "space-between" }}>
        {/* species's picture with/without label */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {selectedSpecies !== "all" && renderImageMap()}
          </div>
          {selectedSpecies !== "all" && renderColorBar()}
        </div>
        {/* markers table */}
        <div style={{ flex: 1, overflow: "auto", minWidth: "0", paddingLeft: "5%" }}>
          {hoveredOrgan && selectedSpecies ? (
            !loadingMarker ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h4>Top 10 markers for {cellType} in {selectedSpecies} {hoveredOrgan}</h4>
                <Table
                  className="compact-table"
                  dataSource={selectedOrganMarkers.map((marker, index) => ({
                    key: index,
                    gene: marker.gene,
                    expression: marker.expression,
                    fraction: marker.fraction,
                  }))}
                  columns={[
                    { title: "Gene", dataIndex: "gene", key: "gene", render: (text) => 
                        selectedSpecies === "h_sapiens" && markerExpressionPlotData.measurement_type === "gene_expression" ? (
                          <a href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${text}`} target="_blank" rel="noopener noreferrer">{text}</a>
                        ) : text },
                    { title: "Expression (cptt)", dataIndex: "expression", key: "expression", align: "center" },
                    { title: "Cell fraction expressing", dataIndex: "fraction", key: "fraction", align: "center" },
                  ]}
                  pagination={false}
                  bordered
                  size="small"
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                <Spin size="large" />
                <p>Loading markers...</p>
              </div>
            )
          ) : null}
        </div>
      </div>

      <div style={{ padding: "24px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {hoveredOrgan && selectedSpecies ? (
          !loadingMarkerPlot ? (
            <div style={{ width: "100%", overflowX: "auto", overflowY: "visible", paddingBottom: "20px" }}>
              <div style={{ minWidth: "max-content", display: "inline-block", height: "auto", minHeight: "600px" }}>
                <BubbleHeatmap
                  state={{
                    plotType: "fractionDetected",
                    xaxis: markerExpressionPlotData.celltypes,
                    yaxis: markerExpressionPlotData.features,
                    average: markerExpressionPlotData.average,
                    fractions: markerExpressionPlotData.fraction_detected,
                    organism: selectedSpecies,
                    organ: markerExpressionPlotData.organ,
                    celltype: false,
                    unit: markerExpressionPlotData.unit,
                    hasLog: hasLog,
                    measurement_type: markerExpressionPlotData.measurement_type,
                    queriedGenes: false,
                    isSurface: false,
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <Spin size="large" />
              <p>Loading plot</p>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
export default CellTypeProfile;
