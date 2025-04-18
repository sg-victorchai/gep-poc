This project is to demonstrate the amazing power of HL7 FHIR (wwww.hl7.org/fhir) and GenAI (GitHub Copilot)

HL7 FHIR is healthcare industry standard to provide consistent data model and APIs, it not only defines the baseline APIs for all common used resources such as Patient, Encounter, MedicationReqeust and CarePlan, HL7 FHIR also defines the metadata for all the resources using these meta resources

  - StructureDefinition - https://hl7.org/fhir/R5/structuredefinition.html
  - SearchParameter - https://hl7.org/fhir/R5/searchparameter.html
  - OperationDefinition - https://hl7.org/fhir/R5/operationdefinition.html

This projet will demonstrate how HL7 FHIR is fundamentally transforming software development within Synapxe software engineering & development subgroup
- Use StructureDefinition to identify what are the list of key data elements (Summary Elements in FHIR StructureDefinition) in the resource, and  automatically create the record summary list
- Use SearchParameter to identify what are search parameters,  automatically display filter fields in record summary list
- Use OperationDefinition to inspect the APIs and its input/output parameters of each API, and generate UI to allow users to perform specific actions


Overall strucutre of this repo
- .copilot folder keeps all the prompt instruction. The prompt itself is also crated by copilot itself.
- fhirprofile folder keeps all the FHIR meta resources
- fhirweb-spa is the sample SPA web application co-created by copilot

Brief journey of copilot assisted development 
1) Spent around 2 hours to get copilot to create the fhir-typescript-spa-prompt md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/fhir-typescript-spa-prompt.md
2) Use the md file to created the initial SPA web application for View and CRUD of 3 resources - Observation, MedicationRequest and CarePlan. Afterwards I spent about 4 hours to get the basic web application running
3) Spent around 2 hours to train copilot to create propmt instructions to auto generate View and CRUD form using FHIR StructureDefinition resources
   - Step 1 - Generate prompt instructions using Observation StrutureDefintion - https://github.com/sg-victorchai/gep-poc/blob/main/fhirprofile/structure-definition-observation.json. The generated instruction is in this md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/ObservationUiGuide.md
   - Step 2 - Since the generaed prompt instruction is very specific to the Observation resources, the second step is to request copilot to make full use of the StructurDefinition, for the columns in table listing view, parse all the data elements where the "isSummary" is true. The generic propmt is in this md file - https://github.com/sg-victorchai/gep-poc/blob/main/.copilot/FHIRResourceUIDevGuide.md. You will see the huge difference comparing with ObservationUiGuide.md
4) Spend around 30 minutes to ask copilot use the FHIRResourceUIDevGuide instructions to add Encounter


You can checkout the code, and run the SPA web application, the backend APIs and system is hosted in Synapxe Innovation Sandbox, I also included the url and api key in the environment file.

Try out and have fun, and let me know any commments!
