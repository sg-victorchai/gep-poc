# This project is to demonstrate the amazing power of HL7 FHIR (https://www.hl7.org/fhir) and GenAI (GitHub Copilot)

## HL7 FHIR Overview

HL7 FHIR is healthcare industry standard to define consistent data model and APIs, it not only defines the baseline mdoel for all common used resources such as Patient, Encounter, MedicationReqeust and CarePlan, it also allows each implementers to extend thorugh its built-in extension mechanism

In addition, HL7 FHIR also defines the metadata for all the resources and APIs using these meta resources. Each project implementation can choose to further constrain the resources in terms of data elements, cardinality, bounded code set, whether the element is sunmary element or not, and what are the elements are searchable.

- StructureDefinition - https://hl7.org/fhir/R5/structuredefinition.html
- SearchParameter - https://hl7.org/fhir/R5/searchparameter.html
- OperationDefinition - https://hl7.org/fhir/R5/operationdefinition.html

Lastly we can also leverage HL7 FHIR syntax to create and define our onw custom resources so that all the APIs are unified, this will bring the tremendous benefits for application development and integration.

## Purpose of this projet

This projet will demonstrate how HL7 FHIR is fundamentally transforming software development in these 4 series,

1. Use StructureDefinition to identify what are the key data elements (Summary Elements in FHIR StructureDefinition) in the resource, and automatically create the record summary list page on UI
2. Use SearchParameter to identify what are search parameters, automatically display filtering fields in record summary list UI
3. Use data elements and data validation rules defined in StructureDefinition to auto render the CRUD form and UI level data validation
4. Use OperationDefinition to inspect the APIs and its input/output parameters of each API, and generate UI to allow users to perform specific actions, eg show "Reschedule appointment" button on UI if the backend API supports rescheduling appointment, and then bring users to the appointment reschedule UI with the input parameters specified in the OperationDefinition.

## Overall strucutre of this repo

1. .copilot folder keeps all the prompt instruction. The prompt itself is also created by copilot itself.
2. fhirprofile folder keeps all the FHIR meta resources
3. fhirweb-spa is the sample SPA web application co-created by copilot

## Brief journey of copilot assisted development - Part 1

1. Spent around 2 hours to get copilot to create the fhir-typescript-spa-prompt md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/fhir-typescript-spa-prompt.md
2. Use the md file to created the initial SPA web application for View and CRUD of 3 resources - Observation, MedicationRequest and CarePlan. In total, I spent about 4 hours to get the basic web application running (including data preparation in Synapxe Innovation Sandbox)
3. Spent around 2 hours to train copilot to create propmt instructions to auto generate View and CRUD form using FHIR StructureDefinition resources

   - Step 1 - Generate prompt instructions using Observation StrutureDefintion - https://github.com/sg-victorchai/gep-poc/blob/main/fhirprofile/structure-definition-observation.json. The generated instruction is in this md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/ObservationUiGuide.md

   - Step 2 - Since the generaed prompt instruction is very specific to the Observation resources, the second step is to request copilot to make full use of the StructurDefinition, for the columns in table listing view, parse all the data elements where the "isSummary" is true. The generic propmt is in this md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/FHIRResourceUIDevGuide.md.

   You will see the huge difference comparing between ObservationUiGuide.md and FHIRResourceUIDevGuide.md

   Snippet from ObservationUiGuide.md

```
// Define columns for the Observation listing table
// Only include elements where isSummary=true
const observationListColumns = [
  {
    header: 'ID',
    accessor: 'id',
    width: '80px',
  },
  {
    header: 'Status',
    accessor: 'status',
    width: '120px',
    // Status is a modifier element and requires special styling
    cell: (status) => <StatusBadge status={status} />,
  }
  ....
```

Snippet from FHIRResourceUIDevGuide.md

```
// Function to extract isSummary elements from structure definition
async function getSummaryElementsFromStructureDefinition(resourceType) {
  // Load the appropriate structure definition file
  const structureDefPath = `/fhirprofile/structure-definition-${resourceType.toLowerCase()}.json`;
  const structureDef = await fetchJSON(structureDefPath);

  // Extract elements where isSummary is true
  const summaryElements = [];
  if (structureDef && structureDef.snapshot && structureDef.snapshot.element) {
    structureDef.snapshot.element.forEach((element) => {
      if (element.isSummary === true) {
        // Extract the element path, removing the resourceType prefix
        const path = element.path.startsWith(`${resourceType}.`)
          ? element.path.substring(resourceType.length + 1)
          : element.path;

        summaryElements.push({
          path,
          definition: element.definition,
          type: element.type ? element.type[0]?.code : null,
        });
      }
    });
  }

  return summaryElements;
}

// Generate columns based on summary elements
async function generateListColumns(resourceType) {
  const summaryElements = await getSummaryElementsFromStructureDefinition(
    resourceType,
  );
```

4. Spend around 30 minutes to ask copilot use the FHIRResourceUIDevGuide instructions to add Encounter

You can checkout the code, and run the SPA web application, the backend APIs and system is hosted in Synapxe Innovation Sandbox (https://innovation.healthx.sg/production-equivalent-apis/), I also included the url and api key in the environment file.

After you start the SPA, please search patient name with "Catherine" which I have prepared some sample records for this patient

![Home Page](./FHIR%20Web%20GenAI%20POC-1.png)
![Patient Records Page](./FHIR%20Web%20GenAI%20POC-2.png)

Try out and have fun!
