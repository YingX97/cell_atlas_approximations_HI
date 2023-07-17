import atlasapprox, { organisms } from "atlasapprox";
import { filterGenes } from "./chatSideEffects";

export const updatePlotState = async (response, plotState, setPlotState) => {
console.log(response);
let intent = response.intent;
let generalIntent = intent.split(".")[0];
let newPlotState = null;
let average, fractions;
let organism = (response.params && response.params.organism) || (plotState && plotState.organism) || "";
let organ = (response.params && response.params.organ) || (plotState && plotState.organ) || "";
//  for some intent, params has features instead of feature
let features = response.params.features || response.params.feature;
let apiCelltypes = await atlasapprox.celltypes(organism, organ);
let celltypes = apiCelltypes.celltypes;

const addGenes = (() => {
    // update parameter for average/fraction plots
    console.log(features);
    features = plotState.features + "," + features.split(',');
    organism = plotState.organism;
    organ = plotState.organ;
    celltypes = plotState.celltypes;
    // check if add command is applied to average or fraction
    if(!plotState.data.fractions) {
        averageIntent();
    } else {
        fractionsIntent();
    }
});

const removeGenes = (() => {
	// console.log(typeof(features));
	features = plotState.features.split(',').filter(g => !features.includes(g)).join(',');
    organism = plotState.organism;
    organ = plotState.organ;
    celltypes = plotState.celltypes;
    // check if add command is applied to average or fraction
    if(!plotState.data.fractions) {
        averageIntent();
    } else {
        fractionsIntent();
    }
});

const markersIntent = async () => {
    let markerCelltype = response.params.celltype;
    let apiMarkers = await atlasapprox.markers(organism, organ, markerCelltype);
    features = apiMarkers.markers.join(",");
    fractionsIntent();
    console.log(typeof(features));
};

const averageIntent = async () => {
    let checkFeatures = features.split(',')
    filterGenes(checkFeatures, organism, organ);

    let apiResponse = await atlasapprox.average(organism, organ, features);
    average = apiResponse.average;
    let apiCelltypes = await atlasapprox.celltypes(organism, organ);
    let celltypes = apiCelltypes.celltypes;
    let plotType = "heatmap";
    newPlotState = {
      intent:"average",
      plotType,
      organism,
      organ,
      features,
      data: {
        type: "matrix",
        xaxis: celltypes,
        yaxis: features.split(","),
        average: average,
        fractions: null,
        valueUnit: "counts per ten thousand",
      },
    };
    console.log(newPlotState);
    setPlotState(newPlotState);
};

const fractionsIntent = async () => {
  let apiFraction = await atlasapprox.fraction_detected(organism, organ, features);
  let apiAverage = await atlasapprox.average(organism, organ, features);
  fractions = apiFraction.fraction_detected;
  average = apiAverage.average;
  let plotType = "bubbleHeatmap";

  newPlotState = {
    intent,
    plotType,
    organism,
    organ,
    features,
    data: {
      type: "matrix",
      xaxis: celltypes,
      yaxis: features.split(','),
      average: average,
      fractions: fractions,
      valueUnit: "counts per million",
    },
  };
  setPlotState(newPlotState);
};

const measureIntent = async () => {
  console.log(features);
    const highestResponse = await atlasapprox.highest_measurement(organism, features, 10);
    const plotType = "barChart";
    let organs = highestResponse.organs;
    let celltypes = highestResponse.celltypes;
    console.log(celltypes);
    const celltypesOrgan = celltypes.map((c, index) => {
      return c + " (" + organs[index] + ")";
    });
    newPlotState = {
      intent,
      plotType,
      organism,
      organs,
      celltypes,
      features,
      data: {
        type: "matrix",
        celltypesOrgan: celltypesOrgan,
        yaxis: highestResponse.average,
        average: highestResponse.average,
        fractions: null,
        valueUnit: "counts per ten thousand",
      },
    };
    setPlotState(newPlotState);
};

const similarGenes = async () => {
  // generate a heatmap by default
  let similarFeatures = response.data.similar_features
  similarFeatures.unshift(features);
  features = similarFeatures.join(",");

  fractionsIntent();

}

const cellxorganIntent = async () => {
    const plotType = "table";
    let apiCellxOrgans = await atlasapprox.celltypexorgan(organism);
    let organs = apiCellxOrgans.organs;
    let detected = apiCellxOrgans.detected;
    let celltypes = apiCellxOrgans.celltypes;
    newPlotState = {
        plotType,
        organism,
        organs,
        celltypes,
        detected,
    }
    setPlotState(newPlotState);
};

const organismsIntent = async () => {
  const plotType = "showOrganisms";
  newPlotState = {
      plotType,
  }
  setPlotState(newPlotState);
};

console.log(generalIntent);
switch (generalIntent) {
    case "add": 
        addGenes();
        break;
	case "remove":
		removeGenes();
		break;
    case "markers":
        markersIntent();
        break;
    case "average":
        averageIntent();
        break;
    case "fraction_detected":
        fractionsIntent();
        break;
    case "highest_measurement":
        measureIntent();
        break;
    case "similar_features":
        similarGenes();
        break;
    case "celltypexorgan":
        cellxorganIntent();
        break;
    case "organisms":
        organismsIntent();
    default:
		console.log("default case")
      	break;
	}
};
