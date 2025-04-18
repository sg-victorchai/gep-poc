import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import {
  useGetResourceByIdQuery,
  useCreateResourceMutation,
  useUpdateResourceMutation,
  useDeleteResourceMutation,
} from '../../services/fhir/client';
import { Encounter } from 'fhir/r5';

const EncounterCrudPage: React.FC = () => {
  const { id: patientId, resourceId } = useParams<{
    id: string;
    resourceId?: string;
  }>();
  const patient = useOutletContext<any>();
  const navigate = useNavigate();

  // State to control view/edit mode - new records start in edit mode, existing in view mode
  const [isEditMode, setIsEditMode] = useState<boolean>(!resourceId);

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
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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

      // Ensure dates are in proper ISO format
      if (cleanedFormData.actualPeriod?.start) {
        cleanedFormData.actualPeriod.start = new Date(
          cleanedFormData.actualPeriod.start,
        ).toISOString();
      }

      if (cleanedFormData.actualPeriod?.end) {
        cleanedFormData.actualPeriod.end = new Date(
          cleanedFormData.actualPeriod.end,
        ).toISOString();
      }

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
          {/* Identification Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Identification
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </div>

          {/* Timing Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Timing</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
          </div>

          {/* Subject Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Subject Information
            </h3>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Patient</p>
              <p className="text-gray-900">
                {formData.subject?.display || '-'}
              </p>
            </div>
          </div>

          {/* Service Provider Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Provider Information
            </h3>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Service Provider
              </p>
              <p className="text-gray-900">
                {formData.serviceProvider?.display || '-'}
              </p>
            </div>
          </div>

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
          {/* Identification Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Identification
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="type.text"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Encounter Type *
                </label>
                <input
                  type="text"
                  id="type.text"
                  name="type.text"
                  value={getEncounterTypeText() || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Annual Check-up"
                />
              </div>

              <div>
                <label
                  htmlFor="type.coding.0.code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Type Code
                </label>
                <input
                  type="text"
                  id="type.coding.0.code"
                  name="type.coding.0.code"
                  value={formData.type?.[0]?.coding?.[0]?.code || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. AMB"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status *
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'planned'}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="planned">Planned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="on-hold">On Hold</option>
                  <option value="discharged">Discharged</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="discontinued">Discontinued</option>
                  <option value="entered-in-error">Entered in Error</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="class.coding.0.display"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Class *
                </label>
                <select
                  id="class.coding.0.display"
                  name="class.coding.0.display"
                  value={getClassDisplay()}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Ambulatory">Ambulatory</option>
                  <option value="Inpatient">Inpatient</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Home Health">Home Health</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Field">Field</option>
                  <option value="Daytime">Daytime</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timing Information */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Timing</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="actualPeriod.start"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date/Time *
                </label>
                <input
                  type="datetime-local"
                  id="actualPeriod.start"
                  name="actualPeriod.start"
                  value={formatDateForInput(formData.actualPeriod?.start)}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                  id="actualPeriod.end"
                  name="actualPeriod.end"
                  value={formatDateForInput(formData.actualPeriod?.end)}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Service Provider Information */}
          <div>
            <label
              htmlFor="serviceProvider.display"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Service Provider
            </label>
            <input
              type="text"
              id="serviceProvider.display"
              name="serviceProvider.display"
              value={formData.serviceProvider?.display || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. General Hospital"
            />
          </div>

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
