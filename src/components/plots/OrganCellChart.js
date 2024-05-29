import React from 'react';
import { useChat } from '../ChatContext'; 
import Plot from 'react-plotly.js';
import {selectAll} from "d3";

const OrganCellChart = ({ state }) => {
  const { setLocalMessage, queryInputRef, inputBorderFlash } = useChat();
  const { plotLocation, apiCellOrgan, organName, measurementType } =  state;
  const scaleFactor = plotLocation === 'celltypes' ? 1.3 : 1; // Scale factor for size adjustment
  // Find the index of the organ, organ cases are different in species
  const organIndex = apiCellOrgan.organs.findIndex(organ => organ.toLowerCase() === organName.toLowerCase());

  // Get cell types and abundances
  let nonZeroData = apiCellOrgan.celltypes.map((cellType, index) => ({
      name: cellType,
      value: apiCellOrgan.detected[index][organIndex]
  }));

  // Restrict to nonzero cell types (necessary because it comes from celltype x organ)
  nonZeroData = nonZeroData.filter(item => item.value > 0);

  // Sort by decreasing abundance
  nonZeroData.sort((item1, item2) => item1.value - item2.value);

  
  // Prepare for plotly
  const data = [{
      type: 'bar',
      y: nonZeroData.map(item => item.name),
      x: nonZeroData.map(item => item.value),
      orientation: 'h',
      marker: {
          color: 'rgb(64, 145, 199)',
          opacity: 0.9,
          line: {
            color: 'rgb(204,204,204)',
            width: 1,
          },
      },
  }];

  let layout = {
      width: 520 * scaleFactor,
      height: 180 + 14.8 * nonZeroData.length * scaleFactor, //14.7
      xaxis: {
        automargin: true,
        title: {
          text: 'Number of cells detected',
          font: {
            size: 13 * scaleFactor,
          },
          standoff: 20 * scaleFactor,
        },
        type: "log",
        range: [-0.2, 4],
      },
      title: {
        text: `<b>Cell type abundance in <span style='color:#0958d9;'>${organName}</span></b>`,
        font: {
          size: 14 * scaleFactor
        },
      },
      yaxis: {
        automargin: true,
        showticklabels: true,
        type: "category",
        autorange: true,
        tickfont: {
          size: 11 * scaleFactor, // Adjusted tick font size
      },
      }
  };

  const yAxisLabelClick = (event) => {
    const clickedCellType = event.target.textContent;
    let message;
    if (measurementType === 'chromatin_accessibility') {
      message = `Show the 10 top marker peaks for ${clickedCellType} in ${apiCellOrgan.organism} ${organName}`
    } else {
      message = `Show 10 markers of ${clickedCellType} in ${apiCellOrgan.organism} ${organName}`;
    }
    setLocalMessage(message);
    inputBorderFlash();
    if (queryInputRef.current) {
      queryInputRef.current.focus(); // Focus the input field
    }
  };

  
  return (
      <Plot 
          data={data}
          layout={layout}
          onAfterPlot={() => {
            // https://stackoverflow.com/questions/47397551/how-to-make-plotly-js-listen-the-click-events-of-the-tick-labels
            document.querySelectorAll('.plot-container .yaxislayer-above')[0].style.cursor = 'pointer';
            document.querySelectorAll('.plot-container .yaxislayer-above')[0].style['pointer-events'] = 'all';

            selectAll(".yaxislayer-above")
              .selectAll('text')
              .on("click", (event) => yAxisLabelClick(event));
          }}
          onInitialized={(figure, graphDiv)=>{
            document.querySelectorAll('.plot-container .yaxislayer-above')[0].style.cursor = 'pointer';
            document.querySelectorAll('.plot-container .yaxislayer-above')[0].style['pointer-events'] = 'all';

            selectAll(".yaxislayer-above")
              .selectAll('text')
              .on("click", (event) => yAxisLabelClick(event));
          }}
      />
  );
};

export default OrganCellChart;
