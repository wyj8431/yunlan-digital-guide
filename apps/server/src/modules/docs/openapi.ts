// OpenAPI 文档定义集中维护接口契约、请求示例和错误响应。
type JsonSchema = Record<string, unknown>;

function errorSchema(...codes: string[]): JsonSchema {
  return {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: codes.length > 0 ? { type: 'string', enum: codes } : { type: 'string' },
      message: { type: 'string' }
    }
  };
}

function jsonResponse(description: string, schema: JsonSchema) {
  return {
    description,
    content: {
      'application/json': { schema }
    }
  };
}

export function createOpenApiDocument(serverUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: '乌镇景区 AI 数字导游 API',
      version: '0.1.0',
      description:
        '景区数字人项目后端接口文档，包含景区资料、导游问答、知识检索、语音识别/合成、讯飞数字人配置和实时 WebSocket 协议。'
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: 'Exhibition', description: '3D 展厅目录与物件信息' },
      { name: 'System', description: '健康检查与接口文档' },
      { name: 'Scenic', description: '景区基础资料' },
      { name: 'Guide', description: '景区导游智能体问答与检索' },
      { name: 'Coze Plugin', description: 'Coze 可调用的受控只读景区数据' },
      { name: 'Speech', description: '讯飞 ASR/TTS 兼容接口' },
      { name: 'Virtual Human', description: '讯飞虚拟人配置' },
      { name: 'Video', description: '示例视频、字幕和弹幕' },
      { name: 'Realtime', description: 'WebSocket 实时会话协议' }
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['System'],
          summary: '健康检查',
          responses: {
            '200': jsonResponse('服务正常', {
              type: 'object',
              required: ['ok', 'service'],
              properties: {
                ok: { type: 'boolean', example: true },
                service: { type: 'string', example: 'yunlan-guide-api' }
              }
            })
          }
        }
      },
      '/api/docs/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'OpenAPI JSON 文档',
          responses: {
            '200': jsonResponse('OpenAPI 3.1 文档', { type: 'object' })
          }
        }
      },
      '/api/exhibition': {
        get: {
          tags: ['Exhibition'],
          summary: '获取 3D 展厅完整目录',
          responses: {
            '200': jsonResponse('3D 展厅目录', { $ref: '#/components/schemas/ExhibitionCatalog' })
          }
        }
      },
      '/api/exhibition/zones': {
        get: {
          tags: ['Exhibition'],
          summary: '获取展厅分区',
          responses: {
            '200': jsonResponse('展厅分区', {
              type: 'object',
              required: ['zones'],
              properties: {
                zones: { type: 'array', items: { $ref: '#/components/schemas/ExhibitionZone' } }
              }
            })
          }
        }
      },
      '/api/exhibition/items': {
        get: {
          tags: ['Exhibition'],
          summary: '获取展厅物件清单',
          responses: {
            '200': jsonResponse('展厅物件清单', {
              type: 'object',
              required: ['items'],
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/ExhibitionItem' } }
              }
            })
          }
        }
      },
      '/api/exhibition/items/{itemId}': {
        get: {
          tags: ['Exhibition'],
          summary: '获取单个展厅物件',
          parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': jsonResponse('展厅物件', {
              type: 'object',
              required: ['item'],
              properties: { item: { $ref: '#/components/schemas/ExhibitionItem' } }
            }),
            '404': jsonResponse('展厅物件不存在', errorSchema('EXHIBITION_ITEM_NOT_FOUND'))
          }
        }
      },
      '/api/scenic-area': {
        get: {
          tags: ['Scenic'],
          summary: '获取当前景区资料摘要',
          responses: {
            '200': jsonResponse('景区资料摘要', { $ref: '#/components/schemas/ScenicAreaSummary' })
          }
        }
      },
      '/api/coze/plugins/official-notices/{spotId}': {
        get: {
          tags: ['Coze Plugin'],
          summary: '查询已登记景区的官方公告',
          description:
            '仅接受已登记的景区 ID；不接受任意提示词或 URL，也不会执行写入操作。适合配置为 Coze 的只读插件。',
          parameters: [
            {
              name: 'spotId',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['wuzhen-scenic-area'] }
            }
          ],
          responses: {
            '200': jsonResponse('官方公告查询结果', {
              $ref: '#/components/schemas/CozeOfficialNotice'
            }),
            '404': jsonResponse('未登记的景区 ID', errorSchema('OFFICIAL_NOTICE_SPOT_NOT_FOUND'))
          }
        }
      },
      '/api/destinations': {
        get: {
          tags: ['Scenic'],
          summary: '获取目的地知识库列表',
          responses: {
            '200': jsonResponse('目的地列表', {
              type: 'object',
              required: ['destinations'],
              properties: {
                destinations: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DestinationSummary' }
                }
              }
            })
          }
        }
      },
      '/api/destinations/{destination}': {
        get: {
          tags: ['Scenic'],
          summary: '获取目的地详细攻略',
          parameters: [
            {
              name: 'destination',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': jsonResponse('目的地攻略', {
              $ref: '#/components/schemas/DestinationGuidePlan'
            }),
            '404': jsonResponse('目的地不存在', errorSchema('DESTINATION_NOT_FOUND'))
          }
        }
      },
      '/api/guide/retrieval': {
        get: {
          tags: ['Guide'],
          summary: '检索景区旅游知识库',
          parameters: [
            {
              name: 'query',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              example: '上海迪士尼亲子游怎么玩？'
            }
          ],
          responses: {
            '200': jsonResponse('检索结果与拼接上下文', {
              type: 'object',
              required: ['query', 'results', 'context'],
              properties: {
                query: { type: 'string' },
                results: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GuideKnowledgeResult' }
                },
                context: { type: 'string' }
              }
            }),
            '400': jsonResponse('查询为空', errorSchema('EMPTY_QUERY'))
          }
        }
      },
      '/api/guide/chat': {
        post: {
          tags: ['Guide'],
          summary: '景区导游智能体问答',
          description:
            '支持文字、历史上下文和图片附件。导游智能体回答全球景区旅游问题，非景区旅游问题会拒答。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuideChatRequest' }
              }
            }
          },
          responses: {
            '200': jsonResponse('导游回答', { $ref: '#/components/schemas/GuideChatResponse' }),
            '400': jsonResponse(
              '请求校验失败',
              errorSchema('EMPTY_MESSAGE', 'INVALID_IMAGE', 'UNSUPPORTED_TOPIC')
            ),
            '500': jsonResponse('服务异常', errorSchema('INTERNAL_ERROR'))
          }
        }
      },
      '/api/speech/transcribe': {
        post: {
          tags: ['Speech'],
          summary: '整段录音识别为文字',
          description: '兼容回退接口。Phase 3B 主链路使用 /api/voice WebSocket 实时识别。',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['audioBase64'],
                  properties: {
                    audioBase64: { type: 'string', description: '音频文件 base64，不要写入日志。' },
                    mimeType: { type: 'string', example: 'audio/webm' }
                  }
                }
              }
            }
          },
          responses: {
            '200': jsonResponse('识别结果', {
              type: 'object',
              required: ['text'],
              properties: { text: { type: 'string' } }
            }),
            '400': jsonResponse('没有上传音频', errorSchema('EMPTY_AUDIO')),
            '422': jsonResponse('没有识别到内容', errorSchema('EMPTY_TRANSCRIPT')),
            '503': jsonResponse('ASR 未配置', errorSchema('ASR_NOT_CONFIGURED')),
            '502': jsonResponse('ASR 供应商失败', errorSchema('ASR_FAILED'))
          }
        }
      },
      '/api/speech/synthesize': {
        post: {
          tags: ['Speech'],
          summary: '文本合成为 MP3 语音',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: { text: { type: 'string', example: '欢迎来到乌镇景区。' } }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'MP3 音频',
              content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } }
            },
            '400': jsonResponse('文本为空', errorSchema('EMPTY_TEXT')),
            '503': jsonResponse('TTS 未配置', errorSchema('TTS_NOT_CONFIGURED')),
            '502': jsonResponse('TTS 供应商失败', errorSchema('EMPTY_TTS_AUDIO', 'TTS_FAILED'))
          }
        }
      },
      '/api/virtual-human/config': {
        get: {
          tags: ['Virtual Human'],
          summary: '获取讯飞虚拟人前端配置',
          description:
            '启用讯飞虚拟人时会返回短期 signedUrl。接口文档不会暴露真实密钥；生产环境应避免把该响应写入日志。',
          responses: {
            '200': jsonResponse('虚拟人配置或本地兜底配置', {
              oneOf: [
                { $ref: '#/components/schemas/VirtualHumanFallbackConfig' },
                { $ref: '#/components/schemas/VirtualHumanXfyunConfig' }
              ]
            })
          }
        }
      },
      '/api/videos': {
        get: {
          tags: ['Video'],
          summary: '获取示例视频列表',
          responses: {
            '200': jsonResponse('六条示例视频', {
              type: 'object',
              required: ['videos'],
              properties: {
                videos: { type: 'array', items: { $ref: '#/components/schemas/VideoSummary' } }
              }
            }),
            '500': jsonResponse(
              '视频服务异常',
              errorSchema('VIDEO_STORAGE_ERROR', 'INTERNAL_ERROR')
            )
          }
        }
      },
      '/api/videos/{videoId}': {
        get: {
          tags: ['Video'],
          summary: '获取视频详情和预置字幕',
          parameters: [{ name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': jsonResponse('视频详情', {
              type: 'object',
              required: ['video'],
              properties: { video: { $ref: '#/components/schemas/VideoDetail' } }
            }),
            '400': jsonResponse('视频 ID 无效', errorSchema('INVALID_VIDEO_ID')),
            '404': jsonResponse('视频不存在', errorSchema('VIDEO_NOT_FOUND')),
            '500': jsonResponse(
              '视频服务异常',
              errorSchema('VIDEO_STORAGE_ERROR', 'INTERNAL_ERROR')
            )
          }
        }
      },
      '/api/videos/{videoId}/subtitles': {
        get: {
          tags: ['Video'],
          summary: '获取视频预置字幕时间轴',
          parameters: [{ name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': jsonResponse('预置字幕', {
              type: 'object',
              required: ['subtitles'],
              properties: {
                subtitles: { type: 'array', items: { $ref: '#/components/schemas/SubtitleCue' } }
              }
            }),
            '400': jsonResponse('视频 ID 无效', errorSchema('INVALID_VIDEO_ID')),
            '404': jsonResponse('视频不存在', errorSchema('VIDEO_NOT_FOUND')),
            '500': jsonResponse(
              '视频服务异常',
              errorSchema('VIDEO_STORAGE_ERROR', 'INTERNAL_ERROR')
            )
          }
        }
      },
      '/api/videos/{videoId}/danmaku': {
        get: {
          tags: ['Video'],
          summary: '按播放时间范围获取弹幕',
          parameters: [
            { name: 'videoId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'from', in: 'query', required: true, schema: { type: 'integer', minimum: 0 } },
            { name: 'to', in: 'query', required: true, schema: { type: 'integer', minimum: 0 } }
          ],
          responses: {
            '200': jsonResponse('指定时间窗口的弹幕', {
              type: 'object',
              required: ['danmaku'],
              properties: {
                danmaku: { type: 'array', items: { $ref: '#/components/schemas/Danmaku' } }
              }
            }),
            '400': jsonResponse(
              '请求参数无效',
              errorSchema('INVALID_VIDEO_ID', 'INVALID_DANMAKU_WINDOW')
            ),
            '404': jsonResponse('视频不存在', errorSchema('VIDEO_NOT_FOUND')),
            '500': jsonResponse(
              '视频服务异常',
              errorSchema('VIDEO_STORAGE_ERROR', 'INTERNAL_ERROR')
            )
          }
        },
        post: {
          tags: ['Video'],
          summary: '校验、过滤并保存一条弹幕',
          parameters: [{ name: 'videoId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CreateDanmakuInput' } }
            }
          },
          responses: {
            '201': jsonResponse('已保存的弹幕', {
              type: 'object',
              required: ['danmaku'],
              properties: { danmaku: { $ref: '#/components/schemas/Danmaku' } }
            }),
            '400': jsonResponse(
              '请求参数无效',
              errorSchema(
                'INVALID_VIDEO_ID',
                'INVALID_DANMAKU_INPUT',
                'INVALID_JSON',
                'INVALID_DANMAKU_CONTENT',
                'INVALID_DANMAKU_TIMESTAMP',
                'INVALID_DANMAKU_POSITION',
                'INVALID_DANMAKU_COLOR'
              )
            ),
            '404': jsonResponse('视频不存在', errorSchema('VIDEO_NOT_FOUND')),
            '500': jsonResponse(
              '视频服务异常',
              errorSchema('VIDEO_STORAGE_ERROR', 'INTERNAL_ERROR')
            )
          }
        }
      },
      '/api/guide/chat/stream': {
        get: {
          tags: ['Realtime'],
          summary: '导游问答 WebSocket 流式接口',
          description:
            'WebSocket 升级接口。客户端发送 { type: "ask", message, image?, history? }，服务端返回 start、delta*、speech-timeline、result、done 或 error。',
          responses: { '101': { description: 'WebSocket 协议切换成功' } }
        }
      },
      '/api/voice': {
        get: {
          tags: ['Realtime'],
          summary: '实时语音 WebSocket 会话',
          description:
            'WebSocket 升级接口。客户端先发送 session.start，再发送 16 kHz 单声道 PCM16 二进制音频块。服务端返回 session.created、transcript.partial*、transcript.final、answer.final、response.done 或 error。',
          responses: { '101': { description: 'WebSocket 协议切换成功' } }
        }
      }
    },
    components: {
      schemas: {
        ExhibitionCatalog: {
          type: 'object',
          required: ['title', 'description', 'source', 'zones', 'items'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            source: { type: 'string' },
            zones: { type: 'array', items: { $ref: '#/components/schemas/ExhibitionZone' } },
            items: { type: 'array', items: { $ref: '#/components/schemas/ExhibitionItem' } }
          }
        },
        ExhibitionZone: {
          type: 'object',
          required: ['id', 'name', 'description', 'order'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            order: { type: 'integer', minimum: 1 }
          }
        },
        ExhibitionItem: {
          type: 'object',
          required: [
            'id',
            'zoneId',
            'name',
            'displayForm',
            'functionDescription',
            'backendTables',
            'coreFields',
            'priority',
            'implemented',
            'interaction'
          ],
          properties: {
            id: { type: 'string' },
            zoneId: { type: 'string' },
            name: { type: 'string' },
            displayForm: { type: 'string' },
            functionDescription: { type: 'string' },
            backendTables: { type: 'array', items: { type: 'string' } },
            coreFields: { type: 'array', items: { type: 'string' } },
            priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
            implemented: { type: 'boolean' },
            interaction: {
              type: 'string',
              enum: ['detail', 'guide', 'scene', 'custom-route', 'monitor']
            }
          }
        },
        VideoSummary: {
          type: 'object',
          required: ['id', 'title', 'description', 'coverUrl', 'videoUrl', 'durationMs'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            coverUrl: { type: 'string' },
            videoUrl: { type: 'string' },
            durationMs: { type: 'integer', minimum: 1 }
          }
        },
        VideoDetail: {
          allOf: [
            { $ref: '#/components/schemas/VideoSummary' },
            {
              type: 'object',
              required: ['subtitleCues'],
              properties: {
                subtitleCues: { type: 'array', items: { $ref: '#/components/schemas/SubtitleCue' } }
              }
            }
          ]
        },
        SubtitleCue: {
          type: 'object',
          required: ['id', 'videoId', 'startMs', 'endMs', 'content'],
          properties: {
            id: { type: 'integer' },
            videoId: { type: 'string' },
            startMs: { type: 'integer', minimum: 0 },
            endMs: { type: 'integer', minimum: 1 },
            content: { type: 'string' }
          }
        },
        Danmaku: {
          type: 'object',
          required: [
            'id',
            'videoId',
            'timestampMs',
            'content',
            'nickname',
            'color',
            'position',
            'createdAt'
          ],
          properties: {
            id: { type: 'integer' },
            videoId: { type: 'string' },
            timestampMs: { type: 'integer', minimum: 0 },
            content: { type: 'string' },
            nickname: { type: 'string' },
            color: { type: 'string', enum: ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'] },
            position: { type: 'string', enum: ['scroll', 'top', 'bottom'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateDanmakuInput: {
          type: 'object',
          required: ['content', 'timestampMs', 'color', 'position'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 80 },
            timestampMs: { type: 'integer', minimum: 0 },
            color: { type: 'string', enum: ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'] },
            position: { type: 'string', enum: ['scroll', 'top', 'bottom'] }
          }
        },
        ScenicAreaSummary: {
          type: 'object',
          required: ['scenicArea', 'spots', 'routes', 'services', 'quickQuestions'],
          properties: {
            scenicArea: { $ref: '#/components/schemas/ScenicAreaInfo' },
            spots: { type: 'array', items: { $ref: '#/components/schemas/Spot' } },
            routes: { type: 'array', items: { $ref: '#/components/schemas/Route' } },
            services: { type: 'array', items: { $ref: '#/components/schemas/Service' } },
            quickQuestions: { type: 'array', items: { type: 'string' } },
            officialInfo: { $ref: '#/components/schemas/ScenicOfficialInfo' }
          }
        },
        ScenicOfficialInfo: {
          type: 'object',
          required: ['status', 'notices'],
          properties: {
            status: { type: 'string', enum: ['live', 'stale', 'fallback', 'unconfigured'] },
            sourceName: { type: 'string' },
            sourceUrl: { type: 'string', format: 'uri' },
            updatedAt: { type: 'string' },
            checkedAt: { type: 'string', format: 'date-time' },
            notices: { type: 'array', items: { type: 'string' } }
          }
        },
        CozeOfficialNotice: {
          type: 'object',
          required: ['title', 'content', 'sourceUrl', 'updatedAt', 'status'],
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            sourceUrl: { type: 'string', format: 'uri' },
            updatedAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['live', 'stale', 'fallback', 'unconfigured'] }
          }
        },
        ScenicAreaInfo: {
          type: 'object',
          required: ['id', 'name', 'description', 'openingHours', 'ticketInfo'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            openingHours: { type: 'string' },
            ticketInfo: { type: 'string' },
            location: { type: 'string' },
            sourceName: { type: 'string' },
            sourceUrl: { type: 'string' },
            sourceUpdatedAt: { type: 'string' }
          }
        },
        Spot: {
          type: 'object',
          required: ['id', 'name', 'summary'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            summary: { type: 'string' }
          }
        },
        Route: {
          type: 'object',
          required: ['id', 'name', 'duration', 'description'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            duration: { type: 'string' },
            description: { type: 'string' }
          }
        },
        Service: {
          type: 'object',
          required: ['id', 'name', 'type', 'description'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' }
          }
        },
        GuideChatRequest: {
          type: 'object',
          properties: {
            message: { type: 'string', example: '帮我规划一条乌镇半日游路线' },
            attachment: { $ref: '#/components/schemas/GuideAttachment' },
            image: {
              ...({ $ref: '#/components/schemas/GuideImageAttachment' } as JsonSchema),
              deprecated: true,
              description: '旧版图片字段，建议使用 attachment。'
            },
            history: {
              type: 'array',
              items: { $ref: '#/components/schemas/ConversationMessage' }
            }
          }
        },
        ConversationMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { type: 'string', enum: ['user', 'assistant'] },
            content: { type: 'string' }
          }
        },
        GuideImageAttachment: {
          type: 'object',
          required: ['mimeType', 'dataUrl'],
          properties: {
            name: { type: 'string' },
            mimeType: {
              type: 'string',
              enum: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
            },
            dataUrl: { type: 'string', description: 'Data URL，最大 10MB。' }
          }
        },
        GuideAttachment: {
          type: 'object',
          required: ['name', 'mimeType', 'kind', 'dataUrl'],
          properties: {
            name: { type: 'string' },
            mimeType: { type: 'string' },
            kind: {
              type: 'string',
              enum: ['image', 'document', 'spreadsheet', 'presentation', 'markdown']
            },
            dataUrl: {
              type: 'string',
              description: 'Base64 Data URL，最大 10MB。'
            },
            sizeBytes: { type: 'integer', minimum: 0 }
          }
        },
        DestinationSummary: {
          type: 'object',
          required: ['id', 'name', 'summary'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            summary: { type: 'string' }
          }
        },
        DestinationGuidePlan: {
          type: 'object',
          required: ['destination', 'sections'],
          properties: {
            destination: { type: 'string' },
            sections: { type: 'array', items: { type: 'string' } }
          }
        },
        GuideChatResponse: {
          type: 'object',
          required: ['answer', 'cards', 'source', 'speechTimeline', 'retrievedKnowledge'],
          properties: {
            answer: { type: 'string' },
            cards: { type: 'array', items: { $ref: '#/components/schemas/RouteCard' } },
            source: { type: 'string', enum: ['llm', 'local-fallback'] },
            speechTimeline: { $ref: '#/components/schemas/GuideSpeechTimeline' },
            retrievedKnowledge: {
              type: 'array',
              items: { $ref: '#/components/schemas/GuideKnowledgeResult' }
            },
            avatarDirective: { $ref: '#/components/schemas/GuideAvatarDirective' }
          }
        },
        GuideAvatarDirective: {
          type: 'object',
          description:
            'Validated optional directive for the currently enabled digital-human avatar.',
          properties: {
            emotion: { type: 'string', enum: ['neutral', 'warm', 'happy', 'thoughtful'] },
            action: {
              type: 'string',
              description: 'Action ID from the virtual-human config catalog.'
            },
            scene: { type: 'string', maxLength: 48 }
          }
        },
        RouteCard: {
          type: 'object',
          required: ['type', 'title', 'duration', 'description'],
          properties: {
            type: { type: 'string', enum: ['route-step'] },
            title: { type: 'string' },
            duration: { type: 'string' },
            description: { type: 'string' }
          }
        },
        GuideSpeechTimeline: {
          type: 'object',
          required: ['text', 'durationMs', 'visemes', 'source'],
          properties: {
            text: { type: 'string' },
            durationMs: { type: 'number' },
            visemes: { type: 'array', items: { $ref: '#/components/schemas/GuideVisemeCue' } },
            source: { type: 'string', enum: ['estimated'] }
          }
        },
        GuideVisemeCue: {
          type: 'object',
          required: ['startMs', 'endMs', 'viseme', 'mouthOpen'],
          properties: {
            startMs: { type: 'number' },
            endMs: { type: 'number' },
            viseme: { type: 'string' },
            mouthOpen: { type: 'number' }
          }
        },
        GuideKnowledgeResult: {
          type: 'object',
          required: ['id', 'title', 'source', 'content', 'keywords', 'score'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            source: { type: 'string', enum: ['destination-knowledge', 'local-scenic'] },
            content: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            score: { type: 'number' }
          }
        },
        VirtualHumanFallbackConfig: {
          type: 'object',
          required: ['enabled', 'provider', 'reason'],
          properties: {
            enabled: { type: 'boolean', const: false },
            provider: { type: 'string', enum: ['three-fallback'] },
            reason: { type: 'string' }
          }
        },
        VirtualHumanXfyunConfig: {
          type: 'object',
          required: [
            'enabled',
            'provider',
            'serviceId',
            'sdkScriptUrl',
            'signedUrl',
            'actions',
            'startConfig',
            'tts'
          ],
          properties: {
            enabled: { type: 'boolean', const: true },
            provider: { type: 'string', enum: ['xfyun-vms'] },
            serviceId: { type: 'string' },
            sdkScriptUrl: { type: 'string' },
            signedUrl: { type: 'string', description: '短期签名地址，不能写入日志或提交。' },
            actions: {
              type: 'array',
              items: { $ref: '#/components/schemas/VirtualHumanAction' }
            },
            startConfig: { type: 'object' },
            tts: { type: 'object' }
          }
        },
        VirtualHumanAction: {
          type: 'object',
          required: ['id', 'label'],
          properties: { id: { type: 'string' }, label: { type: 'string' } }
        }
      }
    }
  };
}
