import Client from 'fhir-kit-client';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  Patient,
  Bundle,
  CarePlan,
  Resource,
  Observation,
  MedicationRequest,
  Encounter,
} from 'fhir/r5';

// Define TypeScript interface for Vite environment variables
interface ImportMetaEnv {
  readonly VITE_FHIR_BASE_URL?: string;
  readonly VITE_API_KEY?: string;
}

// Augment the ImportMeta interface
declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// FHIR server configuration from environment variables
const FHIR_BASE_URL =
  import.meta.env.VITE_FHIR_BASE_URL ||
  'https://api.healthx.sg/fhir/r5/2807f247634c4f3c941568d460835a71';
const API_KEY =
  import.meta.env.VITE_API_KEY || 'QcNaPYYwp57Ib3T2p1uxL3GazNNoF5pt513T1JCP';

// Initialize the FHIR client with API key authentication
export const createFHIRClient = () => {
  return new Client({
    baseUrl: FHIR_BASE_URL,
    customHeaders: {
      'x-api-key': API_KEY,
    },
  });
};

// Get SMART auth metadata
export const getSMARTAuthMetadata = async () => {
  const client = createFHIRClient();
  try {
    const metadata = await client.smartAuthMetadata();
    return metadata;
  } catch (error) {
    console.error('Error getting SMART auth metadata:', error);
    throw error;
  }
};

// RTK Query API for FHIR resources
export const fhirApi = createApi({
  reducerPath: 'fhirApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/', // Will be overridden in queryFn
  }),
  tagTypes: [
    'Patient',
    'CarePlan',
    'Observation',
    'MedicationRequest',
    'Encounter',
    'Practitioner',
    'Organization',
    'Condition',
  ],
  endpoints: (builder) => ({
    getPatient: builder.query<Patient, string>({
      queryFn: async (patientId, _apiState) => {
        try {
          const client = createFHIRClient();
          const patient = await client.read({
            resourceType: 'Patient',
            id: patientId,
          });
          return { data: patient as Patient };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Patient', id }],
    }),
    searchPatients: builder.query<Bundle<Patient>, Record<string, string>>({
      queryFn: async (searchParams, _apiState) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'Patient',
            searchParams,
          });
          return { data: results as Bundle<Patient> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: ['Patient'],
    }),
    getCarePlans: builder.query<Bundle<CarePlan>, string>({
      queryFn: async (patientId, _apiState) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'CarePlan',
            searchParams: {
              patient: patientId,
            },
          });
          return { data: results as Bundle<CarePlan> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, patientId) => [
        { type: 'CarePlan', id: patientId },
      ],
    }),
    getObservations: builder.query<
      Bundle<Observation>,
      { patientId: string; code?: string; date?: string }
    >({
      queryFn: async ({ patientId, code, date }, _api) => {
        try {
          const client = createFHIRClient();
          const searchParams: Record<string, string> = {
            patient: patientId,
          };

          if (code) {
            searchParams.code = code;
          }

          if (date) {
            searchParams.date = date;
          }

          const results = await client.search({
            resourceType: 'Observation',
            searchParams,
          });
          return { data: results as Bundle<Observation> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Observation', id: arg.patientId },
      ],
    }),
    getEncounters: builder.query<Bundle<Encounter>, string>({
      queryFn: async (patientId, { signal }) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'Encounter',
            searchParams: {
              patient: patientId,
            },
          });
          return { data: results as Bundle<Encounter> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, patientId) => [
        { type: 'Encounter', id: patientId },
      ],
    }),
    getMedications: builder.query<Bundle<MedicationRequest>, string>({
      queryFn: async (patientId, { signal }) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'MedicationRequest',
            searchParams: {
              patient: patientId,
            },
          });
          return { data: results as Bundle<MedicationRequest> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, patientId) => [
        { type: 'MedicationRequest', id: patientId },
      ],
    }),
    getNextPage: builder.query<Bundle<Resource>, Bundle<Resource>>({
      queryFn: async (bundle, { signal }) => {
        try {
          const client = createFHIRClient();
          const results = await client.nextPage({ bundle });
          return { data: results as Bundle<Resource> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
    }),
    getPreviousPage: builder.query<Bundle<Resource>, Bundle<Resource>>({
      queryFn: async (bundle, { signal }) => {
        try {
          const client = createFHIRClient();
          const results = await client.prevPage({ bundle });
          return { data: results as Bundle<Resource> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
    }),
    createResource: builder.mutation<
      Resource,
      { resourceType: string; resource: Resource }
    >({
      queryFn: async ({ resourceType, resource }, { signal }) => {
        try {
          const client = createFHIRClient();
          const result = await client.create({
            resourceType,
            body: resource,
          });
          return { data: result as Resource };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      invalidatesTags: (_result, _error, { resourceType }) => {
        // Type assertion to ensure resourceType is one of the tag types
        const tagType = resourceType as
          | 'Patient'
          | 'CarePlan'
          | 'Observation'
          | 'MedicationRequest';
        return [tagType];
      },
    }),
    updateResource: builder.mutation<
      Resource,
      { resourceType: string; id: string; resource: Resource }
    >({
      queryFn: async ({ resourceType, id, resource }, { signal }) => {
        try {
          const client = createFHIRClient();
          const result = await client.update({
            resourceType,
            id,
            body: resource,
          });
          return { data: result as Resource };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      invalidatesTags: (_result, _error, { resourceType, id }) => {
        // Type assertion to ensure resourceType is one of the tag types
        const tagType = resourceType as
          | 'Patient'
          | 'CarePlan'
          | 'Observation'
          | 'MedicationRequest';
        return [{ type: tagType, id }];
      },
    }),
    deleteResource: builder.mutation<
      void,
      { resourceType: string; id: string }
    >({
      queryFn: async ({ resourceType, id }, { signal }) => {
        try {
          const client = createFHIRClient();
          await client.delete({
            resourceType,
            id,
          });
          return { data: undefined };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      invalidatesTags: (_result, _error, { resourceType, id }) => {
        const tagType = resourceType as
          | 'Patient'
          | 'CarePlan'
          | 'Observation'
          | 'MedicationRequest';
        return [{ type: tagType, id }, tagType];
      },
    }),
    getResourceById: builder.query<
      Resource,
      { resourceType: string; id: string }
    >({
      queryFn: async ({ resourceType, id }, { signal }) => {
        try {
          const client = createFHIRClient();
          const resource = await client.read({
            resourceType,
            id,
          });
          return { data: resource as Resource };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (result, error, { resourceType, id }) => [
        { type: resourceType as any, id },
      ],
    }),
    // New endpoints for reference options
    getPractitioners: builder.query<
      Bundle<Resource>,
      { searchParams?: Record<string, string> }
    >({
      queryFn: async (
        { searchParams = { _count: '100', _sort: 'family' } },
        { signal },
      ) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'Practitioner',
            searchParams,
          });
          return { data: results as Bundle<Resource> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: ['Practitioner'],
    }),
    getOrganizations: builder.query<
      Bundle<Resource>,
      { searchParams?: Record<string, string> }
    >({
      queryFn: async (
        { searchParams = { _count: '100', _sort: 'name' } },
        { signal },
      ) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'Organization',
            searchParams,
          });
          return { data: results as Bundle<Resource> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: ['Organization'],
    }),
    getConditions: builder.query<
      Bundle<Resource>,
      { patientId: string; searchParams?: Record<string, string> }
    >({
      queryFn: async (
        { patientId, searchParams = { _count: '100' } },
        { signal },
      ) => {
        try {
          const client = createFHIRClient();
          const results = await client.search({
            resourceType: 'Condition',
            searchParams: {
              patient: patientId,
              ...searchParams,
            },
          });
          return { data: results as Bundle<Resource> };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, { patientId }) => [
        { type: 'Condition', id: patientId },
      ],
    }),
    // Function to get a single practitioner by ID
    getPractitionerById: builder.query<Resource, string>({
      queryFn: async (id, { signal }) => {
        try {
          const client = createFHIRClient();
          const resource = await client.read({
            resourceType: 'Practitioner',
            id,
          });
          return { data: resource as Resource };
        } catch (error) {
          return {
            error: { status: 'FETCH_ERROR', error: String(error) },
          };
        }
      },
      providesTags: (_result, _error, id) => [{ type: 'Practitioner', id }],
    }),
  }),
});

export const {
  useGetPatientQuery,
  useSearchPatientsQuery,
  useGetCarePlansQuery,
  useGetObservationsQuery,
  useGetEncountersQuery,
  useGetMedicationsQuery,
  useGetNextPageQuery,
  useGetPreviousPageQuery,
  useCreateResourceMutation,
  useUpdateResourceMutation,
  useDeleteResourceMutation,
  useGetResourceByIdQuery,
  // Export new hooks
  useGetPractitionersQuery,
  useGetOrganizationsQuery,
  useGetConditionsQuery,
  useGetPractitionerByIdQuery,
} = fhirApi;
