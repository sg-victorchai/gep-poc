import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  useGetResourceByIdQuery,
  useCreateResourceMutation,
  useUpdateResourceMutation,
  useDeleteResourceMutation,
} from '../../services/fhir/client';
import { generateFormGroups } from '../../services/fhir/uiUtils';
import { Encounter } from 'fhir/r5';

// Interface for form group structure
interface FormGroup {
  id: string;
  title: string;
  elements: string[];
  description?: string;
}

const EncounterCrudPage: React.FC = () => {
  const { id: patientId, resourceId } = useParams<{
    id: string;
    resourceId?: string;
  }>();
  const patient = useOutletContext<any>();
  const navigate = useNavigate();

  // State to control view/edit mode - new records start in edit mode, existing in view mode
  const [isEditMode, setIsEditMode] = useState<boolean>(!resourceId);

  // State for form groups - using the required 6 groups for Encounter
  const [formGroups, setFormGroups] = useState<FormGroup[]>([
    {
      id: 'overview',
      title: 'Overview',
      elements: [
        'status',
        'class',
        'type',
        'subject',
        'actualPeriod',
        'serviceProvider',
      ],
      description: 'Basic information about the encounter',
    },
    {
      id: 'diagnosis',
      title: 'Diagnosis',
      elements: ['diagnosis'],
      description: 'Diagnoses relevant to this encounter',
    },
    {
      id: 'participant',
      title: 'Participant',
      elements: ['participant'],
      description: 'Healthcare providers involved in the encounter',
    },
    {
      id: 'reason',
      title: 'Reason',
      elements: ['reasonCode', 'reasonReference'],
      description: 'Reason for the encounter',
    },
    {
      id: 'location',
      title: 'Location',
      elements: ['location'],
      description: 'Where the encounter took place',
    },
    {
      id: 'admission',
      title: 'Admission',
      elements: ['hospitalization'],
      description: 'Details about the admission to a healthcare service',
    },
  ]);

  // State for form
  const [formData, setFormData] = useState<Partial<Encounter>>({
    resourceType: 'Encounter',
    status: 'planned',
    class: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'Ambulatory',
          },
        ],
      },
    ],
    subject: {
      reference: `Patient/${patientId}`,
      display: `${patient?.name?.[0]?.given?.[0] || ''} ${
        patient?.name?.[0]?.family || ''
      }`,
    },
    actualPeriod: {
      start: new Date().toISOString(),
      end: undefined,
    },
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/encounter-type',
            code: '',
            display: '',
          },
        ],
        text: '',
      },
    ],
  });

  // State for reference options
  const [organizationOptions, setOrganizationOptions] = useState<any[]>([]);
  const [conditionOptions, setConditionOptions] = useState<any[]>([]);
  const [practitionerOptions, setPractitionerOptions] = useState<any[]>([]);

  // Fetch existing resource if editing
  const { data: existingResource, isLoading: isLoadingResource } =
    useGetResourceByIdQuery(
      { resourceType: 'Encounter', id: resourceId || '' },
      { skip: !resourceId },
    );

  // Mutations
  const [createResource, { isLoading: isCreating }] =
    useCreateResourceMutation();
  const [updateResource, { isLoading: isUpdating }] =
    useUpdateResourceMutation();
  const [deleteResource, { isLoading: isDeleting }] =
    useDeleteResourceMutation();

  // Load existing data if editing
  useEffect(() => {
    if (existingResource) {
      const encounter = existingResource as Encounter;
      setFormData(encounter);
    }
  }, [existingResource]);

  // Fetch reference options when component mounts
  useEffect(() => {
    const fetchReferenceOptions = async () => {
      try {
        // Fetch organizations for service provider
        const orgResponse = await fetch(
          `https://hapi.fhir.org/baseR4/Organization?_count=100&_sort=name`,
        );
        const orgData = await orgResponse.json();
        if (orgData.entry) {
          setOrganizationOptions(
            orgData.entry.map((entry: any) => ({
              reference: `Organization/${entry.resource.id}`,
              display: entry.resource.name || 'Unknown Organization',
            })),
          );
        }

        // Fetch conditions for diagnosis
        const conditionResponse = await fetch(
          `https://hapi.fhir.org/baseR4/Condition?patient=${patientId}&_count=100`,
        );
        const conditionData = await conditionResponse.json();
        if (conditionData.entry) {
          setConditionOptions(
            conditionData.entry.map((entry: any) => ({
              reference: `Condition/${entry.resource.id}`,
              display:
                entry.resource.code?.coding?.[0]?.display ||
                entry.resource.code?.text ||
                'Unnamed Condition',
            })),
          );
        }

        // Fetch practitioners
        const practitionerResponse = await fetch(
          `https://hapi.fhir.org/baseR4/Practitioner?_count=100&_sort=family`,
        );
        const practitionerData = await practitionerResponse.json();
        if (practitionerData.entry) {
          setPractitionerOptions(
            practitionerData.entry.map((entry: any) => ({
              reference: `Practitioner/${entry.resource.id}`,
              display: entry.resource.name?.[0]?.family
                ? `${entry.resource.name[0].given?.[0] || ''} ${
                    entry.resource.name[0].family
                  }`
                : 'Unknown Practitioner',
            })),
          );
        }
      } catch (error) {
        console.error('Error fetching reference options:', error);
      }
    };

    fetchReferenceOptions();
  }, [patientId]);

  // Add debug logging to track actor references
  useEffect(() => {
    if (formData.participant && formData.participant.length > 0) {
      console.log(
        'Current participant actors:',
        formData.participant.map((p) => p.actor?.reference),
      );
      console.log(
        'Available practitioner options:',
        practitionerOptions.map((p) => p.reference),
      );
    }
  }, [formData.participant, practitionerOptions]);

  // Load practitioners properly for existing participants
  useEffect(() => {
    if (
      formData.participant &&
      formData.participant.length > 0 &&
      practitionerOptions.length > 0
    ) {
      // For each participant that has an actor reference but no matching option in the dropdown
      const updatedParticipants = formData.participant.map((participant) => {
        if (
          participant.actor?.reference &&
          !practitionerOptions.some(
            (option) => option.reference === participant.actor?.reference,
          )
        ) {
          console.log(
            `Need to fetch practitioner details for: ${participant.actor.reference}`,
          );

          // If we have a display name already, keep using the existing data for now
          return participant;
        }
        return participant;
      });

      // Check if we need to update actors that don't match any options
      const needsUpdate = formData.participant.some(
        (p) =>
          p.actor?.reference &&
          !practitionerOptions.some((o) => o.reference === p.actor?.reference),
      );

      if (needsUpdate) {
        // Fetch the missing practitioners
        const fetchMissingPractitioners = async () => {
          try {
            // Extract practitioner IDs from references
            const missingRefs = formData.participant
              .filter(
                (p) =>
                  p.actor?.reference &&
                  !practitionerOptions.some(
                    (o) => o.reference === p.actor?.reference,
                  ),
              )
              .map((p) => p.actor?.reference || '')
              .filter((ref) => ref.startsWith('Practitioner/'))
              .map((ref) => ref.replace('Practitioner/', ''));

            if (missingRefs.length === 0) return;

            console.log('Fetching missing practitioners:', missingRefs);

            // Fetch each missing practitioner
            for (const id of missingRefs) {
              const response = await fetch(
                `https://hapi.fhir.org/baseR4/Practitioner/${id}`,
              );
              if (response.ok) {
                const data = await response.json();
                if (data) {
                  // Add this practitioner to the options
                  const display = data.name?.[0]?.family
                    ? `${data.name[0].given?.[0] || ''} ${data.name[0].family}`
                    : 'Unknown Practitioner';

                  setPractitionerOptions((prev) => [
                    ...prev,
                    {
                      reference: `Practitioner/${id}`,
                      display: display,
                    },
                  ]);

                  console.log(`Added missing practitioner: ${display}`);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching missing practitioners:', error);
          }
        };

        fetchMissingPractitioners();
      }
    }
  }, [formData.participant, practitionerOptions]);

  // Load form groups dynamically on component mount
  // We'll keep the existing hardcoded form groups for now,
  // as there may be issues with the file path for the structure definition
  /*
  useEffect(() => {
    const loadFormGroups = async () => {
      try {
        // Try to load dynamically, but fall back to hardcoded groups on error
        const groups = await generateFormGroups('Encounter');
        console.log('Loaded form groups:', groups);
        
        // Only update state if we got valid groups
        if (groups && groups.length > 0) {
          setFormGroups(groups);
        } else {
          console.warn('Received empty form groups, keeping default ones');
        }
      } catch (error) {
        console.error('Error loading form groups:', error);
        // Keep the default form groups if there's an error
      }
    };

    loadFormGroups();
  }, []);
  */

  // Form change handler
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === 'type.text') {
      setFormData((prev) => ({
        ...prev,
        type: [
          {
            ...prev.type?.[0],
            text: value,
            coding: [
              {
                ...prev.type?.[0]?.coding?.[0],
                display: value,
              },
            ],
          },
        ],
      }));
    } else if (name === 'type.coding.0.code') {
      setFormData((prev) => ({
        ...prev,
        type: [
          {
            ...prev.type?.[0],
            coding: [
              {
                ...prev.type?.[0]?.coding?.[0],
                code: value,
              },
            ],
          },
        ],
      }));
    } else if (name === 'class.coding.0.code') {
      setFormData((prev) => ({
        ...prev,
        class: [
          {
            ...prev.class?.[0],
            coding: [
              {
                ...prev.class?.[0]?.coding?.[0],
                code: value,
              },
            ],
          },
        ],
      }));
    } else if (name === 'class.coding.0.display') {
      setFormData((prev) => ({
        ...prev,
        class: [
          {
            ...prev.class?.[0],
            coding: [
              {
                ...prev.class?.[0]?.coding?.[0],
                display: value,
              },
            ],
          },
        ],
      }));
    } else if (name === 'actualPeriod.start') {
      setFormData((prev) => ({
        ...prev,
        actualPeriod: {
          ...prev.actualPeriod,
          start: new Date(value).toISOString(),
        },
      }));
    } else if (name === 'actualPeriod.end') {
      const endDate = value ? new Date(value).toISOString() : undefined;
      setFormData((prev) => ({
        ...prev,
        actualPeriod: {
          ...prev.actualPeriod,
          end: endDate,
        },
      }));
    } else if (name === 'serviceProvider.display') {
      setFormData((prev) => ({
        ...prev,
        serviceProvider: {
          display: value,
        },
      }));
    } else if (name.startsWith('participant')) {
      // Handle participant array changes
      const participantIndex = parseInt(name.split('.')[1]);
      const fieldName = name.split('.').slice(2).join('.');

      setFormData((prev) => {
        const updatedParticipants = [...(prev.participant || [])];

        // Ensure participant at this index exists
        if (!updatedParticipants[participantIndex]) {
          updatedParticipants[participantIndex] = {};
        }

        // Update the specific field using a helper function
        const updatedParticipant = updateNestedField(
          updatedParticipants[participantIndex],
          fieldName,
          value,
        );

        updatedParticipants[participantIndex] = updatedParticipant;

        return {
          ...prev,
          participant: updatedParticipants,
        };
      });
    } else if (name.startsWith('location')) {
      // Handle location array changes
      const locationIndex = parseInt(name.split('.')[1]);
      const fieldName = name.split('.').slice(2).join('.');

      setFormData((prev) => {
        const updatedLocations = [...(prev.location || [])];

        // Ensure location at this index exists
        if (!updatedLocations[locationIndex]) {
          updatedLocations[locationIndex] = {};
        }

        // Update the specific field using a helper function
        const updatedLocation = updateNestedField(
          updatedLocations[locationIndex],
          fieldName,
          value,
        );

        updatedLocations[locationIndex] = updatedLocation;

        return {
          ...prev,
          location: updatedLocations,
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Add a handler for reference select changes
  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Find the selected option to get both reference and display
    let selectedOption;
    let referenceType = name.split('.')[0];

    if (referenceType === 'serviceProvider') {
      selectedOption = organizationOptions.find(
        (option) => option.reference === value,
      );
    } else if (referenceType === 'diagnosis') {
      selectedOption = conditionOptions.find(
        (option) => option.reference === value,
      );
    } else if (referenceType.includes('reasonReference')) {
      selectedOption = conditionOptions.find(
        (option) => option.reference === value,
      );
    } else if (referenceType.includes('participant')) {
      selectedOption = practitionerOptions.find(
        (option) => option.reference === value,
      );
    }

    if (name === 'serviceProvider.reference') {
      setFormData((prev) => ({
        ...prev,
        serviceProvider: {
          reference: value,
          display: selectedOption?.display || '',
        },
      }));
    } else if (name === 'diagnosis.0.condition.reference') {
      setFormData((prev) => ({
        ...prev,
        diagnosis: [
          {
            ...prev.diagnosis?.[0],
            condition: {
              reference: value,
              display: selectedOption?.display || '',
            },
          },
        ],
      }));
    } else if (name === 'reasonReference.0.reference') {
      setFormData((prev) => ({
        ...prev,
        reasonReference: [
          {
            reference: value,
            display: selectedOption?.display || '',
          },
        ],
      }));
    } else if (
      name.includes('participant') &&
      name.includes('actor.reference')
    ) {
      const participantIndex = parseInt(name.split('.')[1]);

      setFormData((prev) => {
        const updatedParticipants = [...(prev.participant || [])];

        if (!updatedParticipants[participantIndex]) {
          updatedParticipants[participantIndex] = {};
        }

        updatedParticipants[participantIndex] = {
          ...updatedParticipants[participantIndex],
          actor: {
            reference: value,
            display: selectedOption?.display || '',
          },
        };

        return {
          ...prev,
          participant: updatedParticipants,
        };
      });
    }
  };

  // Helper function to update nested fields
  const updateNestedField = (obj: any, path: string, value: any): any => {
    const parts = path.split('.');
    const newObj = { ...obj };

    if (parts.length === 1) {
      newObj[parts[0]] = value;
      return newObj;
    }

    const key = parts[0];
    const remainingPath = parts.slice(1).join('.');

    if (key.includes('[') && key.includes(']')) {
      // Handle array access
      const arrayName = key.split('[')[0];
      const index = parseInt(key.split('[')[1].split(']')[0]);

      if (!newObj[arrayName]) {
        newObj[arrayName] = [];
      }

      if (!newObj[arrayName][index]) {
        newObj[arrayName][index] = {};
      }

      newObj[arrayName][index] = updateNestedField(
        newObj[arrayName][index],
        remainingPath,
        value,
      );
    } else {
      // Handle object access
      if (!newObj[key]) {
        newObj[key] = {};
      }

      newObj[key] = updateNestedField(newObj[key], remainingPath, value);
    }

    return newObj;
  };

  // Helper function to get encounter type text
  const getEncounterTypeText = () => {
    if (formData.type && formData.type.length > 0) {
      if (formData.type[0].text && formData.type[0].text.trim() !== '') {
        return formData.type[0].text;
      } else if (
        formData.type[0].coding &&
        formData.type[0].coding.length > 0 &&
        formData.type[0].coding[0].display
      ) {
        return formData.type[0].coding[0].display;
      }
    }
    return '';
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clean up form data before submitting
      const cleanedFormData = { ...formData };

      // Create a new actualPeriod object with properly formatted dates instead of modifying existing one
      if (cleanedFormData.actualPeriod) {
        const newPeriod: any = {};

        if (cleanedFormData.actualPeriod.start) {
          newPeriod.start = new Date(
            cleanedFormData.actualPeriod.start,
          ).toISOString();
        }

        if (cleanedFormData.actualPeriod.end) {
          newPeriod.end = new Date(
            cleanedFormData.actualPeriod.end,
          ).toISOString();
        }

        // Replace the existing period with our new one
        cleanedFormData.actualPeriod = newPeriod;
      }

      // Remove empty arrays and objects
      Object.keys(cleanedFormData).forEach((key) => {
        if (
          Array.isArray(cleanedFormData[key as keyof typeof cleanedFormData]) &&
          (cleanedFormData[key as keyof typeof cleanedFormData] as any[])
            .length === 0
        ) {
          delete cleanedFormData[key as keyof typeof cleanedFormData];
        } else if (
          typeof cleanedFormData[key as keyof typeof cleanedFormData] ===
            'object' &&
          cleanedFormData[key as keyof typeof cleanedFormData] !== null &&
          Object.keys(
            cleanedFormData[key as keyof typeof cleanedFormData] || {},
          ).length === 0
        ) {
          delete cleanedFormData[key as keyof typeof cleanedFormData];
        }
      });

      if (resourceId) {
        // Update existing resource
        await updateResource({
          resourceType: 'Encounter',
          id: resourceId,
          resource: cleanedFormData as Encounter,
        });
      } else {
        // Create new resource
        await createResource({
          resourceType: 'Encounter',
          resource: cleanedFormData as Encounter,
        });
      }
      // Navigate back to list view after successful operation
      navigate(`/patient/${patientId}/encounter`);
    } catch (error) {
      console.error('Error saving encounter:', error);
      alert('Failed to save encounter. Please try again.');
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (
      !resourceId ||
      !window.confirm('Are you sure you want to delete this encounter?')
    ) {
      return;
    }

    try {
      await deleteResource({
        resourceType: 'Encounter',
        id: resourceId,
      });
      navigate(`/patient/${patientId}/encounter`);
    } catch (error) {
      console.error('Error deleting encounter:', error);
      alert('Failed to delete encounter. Please try again.');
    }
  };

  if (isLoadingResource && resourceId) {
    return (
      <div className="flex justify-center items-center h-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Helper function to format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Helper function to format date for input
  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().substring(0, 16);
    } catch {
      return '';
    }
  };

  // Helper function to get class display text
  const getClassDisplay = () => {
    if (formData.class && formData.class.length > 0) {
      const classCoding = formData.class[0]?.coding?.[0];
      return classCoding?.display || classCoding?.code || '';
    }
    return '';
  };

  // Function to add a new participant
  const addParticipant = () => {
    setFormData((prev) => ({
      ...prev,
      participant: [
        ...(prev.participant || []),
        {
          type: [
            {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                  code: '',
                  display: '',
                },
              ],
            },
          ],
          period: {
            start: new Date().toISOString(),
            end: undefined,
          },
          actor: {
            reference: '',
            display: '',
          },
        },
      ],
    }));
  };

  // Function to add a new location
  const addLocation = () => {
    setFormData((prev) => ({
      ...prev,
      location: [
        ...(prev.location || []),
        {
          status: 'active',
          location: {
            display: '',
          },
        },
      ],
    }));
  };

  // Function to remove a participant
  const removeParticipant = (index: number) => {
    setFormData((prev) => {
      const updatedParticipants = [...(prev.participant || [])];
      updatedParticipants.splice(index, 1);
      return {
        ...prev,
        participant: updatedParticipants.length
          ? updatedParticipants
          : undefined,
      };
    });
  };

  // Function to remove a location
  const removeLocation = (index: number) => {
    setFormData((prev) => {
      const updatedLocations = [...(prev.location || [])];
      updatedLocations.splice(index, 1);
      return {
        ...prev,
        location: updatedLocations.length ? updatedLocations : undefined,
      };
    });
  };

  // Render a group for view mode
  const renderViewGroup = (group: FormGroup) => {
    return (
      <div key={group.id} className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {group.title}
        </h3>
        {group.description && (
          <p className="text-sm text-gray-500 mb-3">{group.description}</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {group.id === 'overview' && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Encounter Type
                </p>
                <p className="text-gray-900">{getEncounterTypeText() || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Status</p>
                <p className="text-gray-900 capitalize">
                  {formData.status || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Class</p>
                <p className="text-gray-900">{getClassDisplay() || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Patient
                </p>
                <p className="text-gray-900">
                  {formData.subject?.display || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Start Date/Time
                </p>
                <p className="text-gray-900">
                  {formatDate(formData.actualPeriod?.start) || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  End Date/Time
                </p>
                <p className="text-gray-900">
                  {formatDate(formData.actualPeriod?.end) || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Service Provider
                </p>
                <p className="text-gray-900">
                  {formData.serviceProvider?.display || '-'}
                </p>
              </div>
            </>
          )}

          {group.id === 'diagnosis' && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Condition
                </p>
                <p className="text-gray-900">
                  {formData.diagnosis?.[0]?.condition?.display || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Use</p>
                <p className="text-gray-900">
                  {formData.diagnosis?.[0]?.use?.coding?.[0]?.code
                    ? (() => {
                        const code = formData.diagnosis[0].use.coding[0].code;
                        const useMap: Record<string, string> = {
                          AD: 'Admission Diagnosis',
                          DD: 'Discharge Diagnosis',
                          CC: 'Chief Complaint',
                          CM: 'Comorbidity',
                          'pre-op': 'Pre-operative Diagnosis',
                          'post-op': 'Post-operative Diagnosis',
                          billing: 'Billing Diagnosis',
                        };
                        return useMap[code] || code;
                      })()
                    : '-'}
                </p>
              </div>
            </>
          )}

          {group.id === 'participant' && (
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Participants
              </p>
              {formData.participant && formData.participant.length > 0 ? (
                <div className="space-y-2">
                  {formData.participant.map((participant, index) => (
                    <div
                      key={index}
                      className="pl-3 border-l-2 border-gray-200"
                    >
                      <p className="text-gray-900">
                        <span className="font-medium">Type:</span>{' '}
                        {participant.type?.[0]?.coding?.[0]?.display || '-'}
                      </p>
                      <p className="text-gray-900">
                        <span className="font-medium">Actor:</span>{' '}
                        {participant.actor?.display || '-'}
                      </p>
                      <p className="text-sm text-gray-500">
                        <span className="font-medium">Period:</span>{' '}
                        {participant.period?.start
                          ? `Start: ${formatDate(participant.period.start)}`
                          : ''}
                        {participant.period?.end
                          ? ` End: ${formatDate(participant.period.end)}`
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No participants added.
                </p>
              )}
            </div>
          )}

          {group.id === 'reason' && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Reason Code
                </p>
                <p className="text-gray-900">
                  {formData.reasonCode?.[0]?.coding?.[0]?.display || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Reason Reference
                </p>
                <p className="text-gray-900">
                  {formData.reasonReference?.[0]?.display || '-'}
                </p>
              </div>
            </>
          )}

          {group.id === 'location' && (
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Locations
              </p>
              {formData.location && formData.location.length > 0 ? (
                <div className="space-y-2">
                  {formData.location.map((location, index) => (
                    <div
                      key={index}
                      className="pl-3 border-l-2 border-gray-200"
                    >
                      <p className="text-gray-900">
                        {location.location?.display || '-'}
                        {location.status && (
                          <span className="text-gray-500">
                            {' '}
                            ({location.status})
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No locations added.
                </p>
              )}
            </div>
          )}

          {group.id === 'admission' && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Admission Details
              </p>
              <p className="text-gray-900">
                {formData.hospitalization?.admitSource?.coding?.[0]?.display ||
                  '-'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a group for edit mode
  const renderEditGroup = (group: FormGroup) => {
    return (
      <div key={group.id} className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">
          {group.title}
        </h3>
        {group.description && (
          <p className="text-sm text-gray-500 mb-3">{group.description}</p>
        )}

        {/* Render form fields based on group elements */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {group.id === 'overview' && (
            <>
              <div>
                <label
                  htmlFor="type.text"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Encounter Type
                </label>
                <input
                  type="text"
                  name="type.text"
                  id="type.text"
                  value={formData.type?.[0]?.text || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="planned">Planned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="finished">Finished</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="entered-in-error">Entered in Error</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="class.coding.0.code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Class
                </label>
                <select
                  id="class.coding.0.code"
                  name="class.coding.0.code"
                  value={formData.class?.[0]?.coding?.[0]?.code || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a class</option>
                  <option value="AMB">Ambulatory</option>
                  <option value="EMER">Emergency</option>
                  <option value="IMP">Inpatient</option>
                  <option value="ACUTE">Acute</option>
                  <option value="NONAC">Non-Acute</option>
                  <option value="PRENC">Pre-Admission</option>
                  <option value="SS">Short Stay</option>
                  <option value="VR">Virtual</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="subject.display"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Patient
                </label>
                <input
                  type="text"
                  name="subject.display"
                  id="subject.display"
                  value={formData.subject?.display || ''}
                  readOnly
                  disabled
                  className="bg-gray-100 shadow-sm block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label
                  htmlFor="actualPeriod.start"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date/Time
                </label>
                <input
                  type="datetime-local"
                  name="actualPeriod.start"
                  id="actualPeriod.start"
                  value={formatDateForInput(formData.actualPeriod?.start)}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label
                  htmlFor="actualPeriod.end"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date/Time
                </label>
                <input
                  type="datetime-local"
                  name="actualPeriod.end"
                  id="actualPeriod.end"
                  value={formatDateForInput(formData.actualPeriod?.end)}
                  onChange={handleChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label
                  htmlFor="serviceProvider.reference"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Service Provider
                </label>
                <select
                  name="serviceProvider.reference"
                  id="serviceProvider.reference"
                  value={formData.serviceProvider?.reference || ''}
                  onChange={handleReferenceChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a service provider</option>
                  {organizationOptions.map((option) => (
                    <option key={option.reference} value={option.reference}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {group.id === 'diagnosis' && (
            <div className="sm:col-span-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="diagnosis.0.condition.reference"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Condition
                  </label>
                  <select
                    name="diagnosis.0.condition.reference"
                    id="diagnosis.0.condition.reference"
                    value={formData.diagnosis?.[0]?.condition?.reference || ''}
                    onChange={handleReferenceChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a condition</option>
                    {conditionOptions.map((option) => (
                      <option key={option.reference} value={option.reference}>
                        {option.display}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="diagnosis.0.use.coding.0.code"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Use
                  </label>
                  <select
                    name="diagnosis.0.use.coding.0.code"
                    id="diagnosis.0.use.coding.0.code"
                    value={
                      formData.diagnosis?.[0]?.use?.coding?.[0]?.code || ''
                    }
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select diagnosis use</option>
                    <option value="AD">Admission Diagnosis</option>
                    <option value="DD">Discharge Diagnosis</option>
                    <option value="CC">Chief Complaint</option>
                    <option value="CM">Comorbidity</option>
                    <option value="pre-op">Pre-operative Diagnosis</option>
                    <option value="post-op">Post-operative Diagnosis</option>
                    <option value="billing">Billing Diagnosis</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {group.id === 'participant' && (
            <div className="sm:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Participants
                </label>
                <button
                  type="button"
                  onClick={addParticipant}
                  className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Participant
                </button>
              </div>

              {(formData.participant || []).map((participant, index) => (
                <div
                  key={index}
                  className="border border-gray-200 p-3 rounded-md mb-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Type field */}
                    <div>
                      <label
                        htmlFor={`participant.${index}.type.0.coding.0.display`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Type
                      </label>
                      <input
                        type="text"
                        name={`participant.${index}.type.0.coding.0.display`}
                        id={`participant.${index}.type.0.coding.0.display`}
                        value={
                          participant.type?.[0]?.coding?.[0]?.display || ''
                        }
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Actor field (reference) */}
                    <div>
                      <label
                        htmlFor={`participant.${index}.actor.reference`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Actor
                      </label>
                      <select
                        name={`participant.${index}.actor.reference`}
                        id={`participant.${index}.actor.reference`}
                        value={participant.actor?.reference || ''}
                        onChange={handleReferenceChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select actor</option>
                        {practitionerOptions.map((option) => (
                          <option
                            key={option.reference}
                            value={option.reference}
                          >
                            {option.display}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Period start field */}
                    <div>
                      <label
                        htmlFor={`participant.${index}.period.start`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Period Start
                      </label>
                      <input
                        type="datetime-local"
                        name={`participant.${index}.period.start`}
                        id={`participant.${index}.period.start`}
                        value={formatDateForInput(participant.period?.start)}
                        onChange={handleChange}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>

                    {/* Period end field */}
                    <div>
                      <label
                        htmlFor={`participant.${index}.period.end`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Period End
                      </label>
                      <input
                        type="datetime-local"
                        name={`participant.${index}.period.end`}
                        id={`participant.${index}.period.end`}
                        value={formatDateForInput(participant.period?.end)}
                        onChange={handleChange}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeParticipant(index)}
                      className="px-2 py-1 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 focus:outline-none"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {!formData.participant?.length && (
                <p className="text-sm text-gray-500 italic">
                  No participants added yet.
                </p>
              )}
            </div>
          )}

          {group.id === 'reason' && (
            <>
              <div>
                <label
                  htmlFor="reasonCode.0.coding.0.display"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Reason Code
                </label>
                <input
                  type="text"
                  name="reasonCode.0.coding.0.display"
                  id="reasonCode.0.coding.0.display"
                  value={formData.reasonCode?.[0]?.coding?.[0]?.display || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="reasonReference.0.reference"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Reason Reference
                </label>
                <select
                  name="reasonReference.0.reference"
                  id="reasonReference.0.reference"
                  value={formData.reasonReference?.[0]?.reference || ''}
                  onChange={handleReferenceChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a reason reference</option>
                  {conditionOptions.map((option) => (
                    <option key={option.reference} value={option.reference}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {group.id === 'location' && (
            <div className="sm:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Locations
                </label>
                <button
                  type="button"
                  onClick={addLocation}
                  className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Location
                </button>
              </div>

              {(formData.location || []).map((location, index) => (
                <div
                  key={index}
                  className="border border-gray-200 p-3 rounded-md mb-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`location.${index}.location.display`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Location Name
                      </label>
                      <input
                        type="text"
                        name={`location.${index}.location.display`}
                        id={`location.${index}.location.display`}
                        value={location.location?.display || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`location.${index}.status`}
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Status
                      </label>
                      <select
                        name={`location.${index}.status`}
                        id={`location.${index}.status`}
                        value={location.status || 'active'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="planned">Planned</option>
                        <option value="reserved">Reserved</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLocation(index)}
                      className="px-2 py-1 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 focus:outline-none"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {!formData.location?.length && (
                <p className="text-sm text-gray-500 italic">
                  No locations added yet.
                </p>
              )}
            </div>
          )}

          {group.id === 'admission' && (
            <div className="sm:col-span-2">
              <label
                htmlFor="hospitalization.admitSource.coding.0.display"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Admission Source
              </label>
              <input
                type="text"
                name="hospitalization.admitSource.coding.0.display"
                id="hospitalization.admitSource.coding.0.display"
                value={
                  formData.hospitalization?.admitSource?.coding?.[0]?.display ||
                  ''
                }
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter admission source"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">
            {!resourceId
              ? 'Create New Encounter'
              : isEditMode
              ? 'Edit Encounter'
              : 'Encounter Details'}
          </h2>
          <p className="text-gray-600">
            {!resourceId
              ? `Creating new encounter for ${patient?.name?.[0]?.given?.[0]} ${patient?.name?.[0]?.family}`
              : `Encounter for ${patient?.name?.[0]?.given?.[0]} ${patient?.name?.[0]?.family}`}
          </p>
        </div>

        {resourceId && !isEditMode && (
          <button
            type="button"
            onClick={() => setIsEditMode(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Edit
          </button>
        )}
      </div>

      {/* View mode for existing records */}
      {resourceId && !isEditMode ? (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          {formGroups.map(renderViewGroup)}

          {/* Action buttons */}
          <div className="flex justify-between pt-4">
            <div>
              <button
                type="button"
                onClick={() => navigate(`/patient/${patientId}/encounter`)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="ml-3 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200"
        >
          {formGroups.map(renderEditGroup)}

          {/* Form Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div>
              {resourceId && isEditMode ? (
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel Editing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/patient/${patientId}/encounter`)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}

              {resourceId && isEditMode && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="ml-3 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isCreating || isUpdating
                ? 'Saving...'
                : resourceId
                ? 'Update Encounter'
                : 'Create Encounter'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EncounterCrudPage;
