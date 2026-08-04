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
          // Paginated, yet the definitions document no page_cursor parameter.
          hasPagination: true,
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
        },
      ],
    },
  ],
} as unknown as Blueprint
