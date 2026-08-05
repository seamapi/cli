import type { Blueprint } from '@seamapi/blueprint'

/**
 * A blueprint with just enough shape to derive a command spec from, standing
 * in for the API definitions bundled with the CLI.
 */
export const testBlueprint = {
  routes: [
    {
      endpoints: [
        {
          path: '/devices/list',
          title: 'List Devices',
          description:
            'Returns a list of all [devices](https://docs.seam.co). Results are paginated.',
          request: {
            parameters: [
              {
                name: 'limit',
                description: 'Number of devices to return.',
                format: 'number',
                isRequired: false,
              },
              {
                name: 'device_type',
                description: 'Device type: for which you want to list devices.',
                format: 'enum',
                isRequired: false,
                values: [{ name: 'august_lock' }, { name: 'schlage_lock' }],
              },
              {
                name: 'is_managed',
                description: "Whether the device's account is managed.",
                format: 'boolean',
                isRequired: false,
              },
            ],
          },
          response: { responseType: 'resource_list', responseKey: 'devices' },
        },
        {
          path: '/devices/unmanaged/get',
          title: '',
          description: 'Gets an unmanaged device. Only some fields are set.',
          request: {
            parameters: [
              {
                name: 'device_id',
                description: 'ID of the device.',
                format: 'id',
                isRequired: true,
              },
            ],
          },
          response: { responseType: 'resource', responseKey: 'device' },
        },
        {
          path: '/access_codes/create',
          title: 'Create an Access Code',
          description: 'Creates an access code on a device.',
          request: {
            parameters: [
              {
                name: 'device_id',
                description: 'ID of the device.',
                format: 'id',
                isRequired: true,
              },
              {
                name: 'code',
                description: 'Code to program, e.g., with leading zeroes.',
                format: 'string',
                isRequired: false,
              },
              {
                name: 'accepted_providers',
                description: 'Providers to accept.',
                format: 'list',
                itemFormat: 'string',
                isRequired: false,
              },
            ],
          },
          response: { responseType: 'resource', responseKey: 'access_code' },
        },
      ],
    },
  ],
} as unknown as Blueprint
