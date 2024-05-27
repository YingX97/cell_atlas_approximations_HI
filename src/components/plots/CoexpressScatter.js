import React from 'react';
import Plot from 'react-plotly.js';
import { Button, Tooltip } from 'antd';
import chroma from 'chroma-js';
import orgMeta from '../../utils/organismMetadata.js';

const CoexpressScatter = ({ state }) => {

    let { organism, features, expData, unit, hasLog, by } = state;

    let dataSource = orgMeta[organism]?.dataSource || "Data source not available";
    let paperHyperlink = orgMeta[organism]?.paperHyperlink || "Hyperlink unavailable";

    const logTransformOrNone = value => hasLog ?  Math.log10(value + 1) : value;
    expData = expData.map(item => ({
        ...item,
        average: item.average.map(averageArray => averageArray.map(logTransformOrNone).map(value => value.toPrecision(5)))
    }));

    if (hasLog) {
        unit = `log10(${unit})`;
    }

    // Generate unique colors for each organ using chroma-js
    const organs = expData.map(item => item.organ);
    const colors = chroma.scale('Spectral').mode('lch').colors(organs.length);

    const organColorMap = organs.reduce((acc, organ, index) => {
        acc[organ] = colors[index];
        return acc;
    }, {});

    const plotData = expData.map(item => ({
        x: item.average[0],
        y: item.average[1],
        mode: 'markers',
        type: 'scatter',
        name: item.organ,
        text: item.average[0].map((_, idx) => {
            const baseText = `${features[0]}: ${item.average[0][idx]}<br>${features[1]}: ${item.average[1][idx]}<br>Organ: ${item.organ}`;
            return by === "celltype" ? `${baseText}<br>Cell type: ${item.celltypes[idx]}` : `${baseText}<br>Cell state: ${idx + 1}`;
        }),
        marker: { 
            size: 12,
            color: organColorMap[item.organ],
            symbol: by === "celltype" ? 'circle' : 'square',
        },
        hoverinfo: 'text',
    }));

    var layout = {
        title: `Coexpression of ${features[0]} and ${features[1]} across ${by} and organs in ${organism}`,
        xaxis: {
            title: features[0] + ` (${unit})`,
            autorange: true,
        },
        yaxis: {
            title: `${features[1]}<br>(${unit})`,
            autorange: true
        }
      };


  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
        <div>
            <Plot
                data={plotData}
                layout={layout}
            />
        </div>
        <div>
            <Tooltip placement="rightTop" color="#108ee9" title={dataSource} overlayStyle={{ maxWidth: '600px', overflowX: 'auto' }}>
            <Button href={paperHyperlink} target="_blank">Data source</Button>
            </Tooltip>
        </div>
    </div>
  );
};

export default CoexpressScatter;
