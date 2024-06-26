import { buildAnswer } from './nlpResponseGenerator.js';
import { downloadFasta } from "../downloadHelpers/downloadFasta.js";
import { downloadTable } from "../downloadHelpers/downloadTable.js";
import { downloadCSV } from "../downloadHelpers/downloadCSV.js";

// Function to handle intents that do not require an API call
export function handleNoApiIntents(mainIntent, subIntent, intent, plotState, params) {
  let answer;

  switch (mainIntent) {
    // handle data download
    case "download":
      let downloadAvailable = false;
      if (plotState.plotType === 'featureSequences') {
        try {
          downloadFasta(plotState);
          downloadAvailable = true;
        } catch (err) {
          downloadAvailable = false;
        }
      } else if (plotState.plotType === 'celltypeXorgan' || plotState.plotType === 'organXorganism') {
        try {
          downloadTable(plotState, plotState.plotType)
          downloadAvailable = true;
        } catch (err) {
          downloadAvailable = false;
        }
      } else if (plotState.plotType === 'homologs') {
        try {
          downloadCSV(plotState);
          downloadAvailable = true;
        } catch (err) {
          downloadAvailable = false;
        }
      }
      answer = buildAnswer(intent, plotState, { success: downloadAvailable });
      return {
        message: answer,
      };
    // handle log and unlog data
    case "plot":
      answer = buildAnswer(intent, plotState);
      return {
        hasData: true,
        params: params,
        data: plotState.data,
        message: answer,
      };
    case "greetings":
      if (subIntent === "bye") {
        return {
          resetEverything: true,
          message: "",
        };
      }
      answer = buildAnswer(intent, plotState);
      return {
        message: answer,
      };
    case "link":
      answer = buildAnswer(intent, plotState);
      return {
        message: answer,
      };
      default:
        return {
          message: "Unhandled intent"
    };
  }
}