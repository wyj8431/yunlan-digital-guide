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
      { name: 'System', description: '健康检查与接口文档' },
      { name: 'Scenic', description: '景区基础资料' },
      { name: 'Guide', description: '景区导游智能体问答与检索' },
      { name: 'Speech', description: '讯飞 ASR/TTS 兼容接口' },
      { name: 'Virtual Human', description: '讯飞虚拟人配置' },
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
      '/api/scenic-area': {
        get: {
          tags: ['Scenic'],
          summary: '获取当前景区资料摘要',
          responses: {
            '200': jsonResponse('景区资料摘要', { $ref: '#/components/schemas/ScenicAreaSummary' })
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
        ScenicAreaSummary: {
          type: 'object',
          required: ['scenicArea', 'spots', 'routes', 'services', 'quickQuestions'],
          properties: {
            scenicArea: { $ref: '#/components/schemas/ScenicAreaInfo' },
            spots: { type: 'array', items: { $ref: '#/components/schemas/Spot' } },
            routes: { type: 'array', items: { $ref: '#/components/schemas/Route' } },
            services: { type: 'array', items: { $ref: '#/components/schemas/Service' } },
            quickQuestions: { type: 'array', items: { type: 'string' } }
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
            }
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
