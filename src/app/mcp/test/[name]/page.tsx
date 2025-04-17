"use client";

import {
  callMcpToolAction,
  selectMcpClientAction,
} from "@/app/api/mcp/actions";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { Input } from "ui/input";
import { Separator } from "ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "ui/resizable";
import { Skeleton } from "ui/skeleton";
import { Button } from "ui/button";
import { Textarea } from "ui/textarea";
import JsonView from "@/components/ui/json-view";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { safeJSONParse, isNull, isString } from "lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";
import { Badge } from "ui/badge";
import { handleErrorWithToast } from "ui/shared-toast";

// Type definitions
type SchemaProperty = {
  type: string;
  required: boolean;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
};

type SimplifiedSchema = Record<string, SchemaProperty>;

type ToolInfo = {
  name: string;
  description: string;
  inputSchema?: any;
};

type CallResult = {
  success: boolean;
  data?: any;
  error?: string;
};

// Helper function to create simplified schema view
const createSimplifiedSchema = (schema: any): SimplifiedSchema => {
  if (!schema || !schema.properties) return {};

  const simplified: SimplifiedSchema = {};
  const requiredFields = schema.required || [];

  for (const [key, value] of Object.entries(schema.properties)) {
    const prop = value as any;

    simplified[key] = {
      type: prop.type,
      required: requiredFields.includes(key),
    };

    if (prop.enum) {
      simplified[key].enum = prop.enum;
    }

    if (prop.type === "object" && prop.properties) {
      simplified[key].properties = createSimplifiedSchema({
        properties: prop.properties,
        required: prop.required || [],
      });
    }
  }

  return simplified;
};

// Recursive schema property renderer component
const SchemaProperty = ({
  name,
  schema,
  level = 0,
}: {
  name: string;
  schema: SchemaProperty;
  level?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 1);
  const isObject = schema.type === "object" && schema.properties;

  return (
    <div
      className={`pb-2 border-b border-border last:border-0 ${
        level > 0 ? "ml-3 pl-2 border-l" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {isObject && (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-5 w-5"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}
        <span className="text-sm font-medium">{name}</span>
        {schema.required && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            required
          </Badge>
        )}
      </div>

      <div className="text-xs text-muted-foreground mt-1">
        <span>type: {schema.type}</span>
        {schema.enum && (
          <div className="mt-1">
            <span>enum: </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {schema.enum.map((item) => (
                <Badge key={item} variant="secondary" className="text-[10px]">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {isObject && isExpanded && schema.properties && (
        <div className="mt-2 space-y-2">
          {Object.entries(schema.properties).map(([key, value]) => (
            <SchemaProperty
              key={key}
              name={key}
              schema={value}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Tool list item component
const ToolListItem = ({
  tool,
  isSelected,
  onClick,
}: {
  tool: ToolInfo;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    className={`flex border-secondary border cursor-pointer rounded-md p-2 transition-colors ${
      isSelected ? "bg-secondary" : "hover:bg-secondary"
    }`}
    onClick={onClick}
  >
    <div className="flex-1 w-full">
      <p className="font-medium text-sm mb-1">{tool.name}</p>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {tool.description}
      </p>
    </div>
  </div>
);

// Description display component
const ToolDescription = ({
  description,
  showFullDescription,
  toggleDescription,
}: {
  description: string;
  showFullDescription: boolean;
  toggleDescription: () => void;
}) => (
  <div className="mb-6">
    <p className="text-sm text-muted-foreground">
      {showFullDescription
        ? description
        : `${description.slice(0, 300)}${description.length > 300 ? "..." : ""}`}
    </p>
    {description.length > 300 && (
      <Button
        variant="ghost"
        className="ml-auto p-0 h-6 mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center"
        onClick={toggleDescription}
      >
        {showFullDescription ? (
          <>
            Show less
            <ChevronUp className="ml-1 h-3 w-3" />
          </>
        ) : (
          <>
            Show more
            <ChevronDown className="ml-1 h-3 w-3" />
          </>
        )}
      </Button>
    )}
  </div>
);

export default function Page() {
  const { name } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToolIndex, setSelectedToolIndex] = useState<number>(0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Tool testing state
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [showInputSchema, setShowInputSchema] = useState(false);

  const { data: client, isLoading } = useSWR(`/mcp/${name}`, () =>
    selectMcpClientAction(name as string),
  );

  const selectedTool = useMemo(() => {
    return client?.toolInfo?.[selectedToolIndex];
  }, [client, selectedToolIndex]);

  const simplifiedSchema = useMemo(() => {
    if (!selectedTool?.inputSchema) return null;
    return createSimplifiedSchema(selectedTool.inputSchema);
  }, [selectedTool]);

  const filteredTools = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    return (
      client?.toolInfo?.filter(
        (tool) =>
          tool.name.toLowerCase().includes(trimmedQuery) ||
          tool.description.toLowerCase().includes(trimmedQuery),
      ) || []
    );
  }, [client?.toolInfo, searchQuery]);

  const toggleDescription = () => setShowFullDescription(!showFullDescription);
  const toggleInputSchema = () => setShowInputSchema(!showInputSchema);

  const handleInputChange = (data: string) => {
    setJsonInput(data);
    if (data.trim() === "") {
      setJsonError(null);
      return;
    }

    const result = safeJSONParse(data);
    if (!result.success) {
      setJsonError(
        (result.error as Error)?.message ??
          JSON.stringify(result.error, null, 2),
      );
    } else {
      setJsonError(null);
    }
  };

  const handleToolCall = async () => {
    if (!selectedTool) return;

    const parsedInput = safeJSONParse(jsonInput || "{}");
    if (!parsedInput.success)
      return handleErrorWithToast(parsedInput.error as Error);

    setIsCallLoading(true);
    try {
      const result = await callMcpToolAction(
        name as string,
        selectedTool.name,
        parsedInput.value,
      );

      setCallResult({
        success: true,
        data: result,
      });
    } catch (error) {
      setCallResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsCallLoading(false);
    }
  };

  // Skeleton loader for tool list
  const renderSkeletons = () => (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="w-full h-14" />
      ))}
    </>
  );

  // Empty state message
  const renderEmptyState = () => (
    <p className="text-sm text-muted-foreground text-center py-4">
      {client?.toolInfo?.length ? "No search results" : "No tools available"}
    </p>
  );

  useEffect(() => {
    setCallResult(null);
    setIsCallLoading(false);
    setJsonError(null);
    setJsonInput("");
    setShowInputSchema(false);
    setShowFullDescription(false);
  }, [selectedToolIndex]);

  return (
    <div className="relative flex flex-col max-w-5xl px-4 mx-4 md:mx-auto w-full h-full py-4">
      <div className="absolute bottom-0 left-0 w-full h-[10%] z-10 bg-gradient-to-b from-transparent to-background pointer-events-none" />

      <div className="bg-background pb-2">
        <Link
          href="/mcp"
          className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors pb-4"
        >
          <ArrowLeft className="size-3" />
          Back
        </Link>
        <header>
          <h2 className="text-3xl font-semibold my-2">
            {decodeURIComponent(name as string)}
          </h2>
        </header>
      </div>

      <ResizablePanelGroup direction="horizontal" className="mt-4">
        {/* Tool List Panel */}
        <ResizablePanel defaultSize={30}>
          <div className="w-full flex flex-col h-full relative pr-8">
            <div className="top-0 pb-2 z-1">
              <div className="w-full relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search tools..."
                  className="pl-8 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 h-full overflow-y-auto no-scrollbar">
              {isLoading
                ? renderSkeletons()
                : filteredTools.length > 0
                  ? filteredTools.map((tool, index) => (
                      <ToolListItem
                        key={tool.name}
                        tool={tool}
                        isSelected={selectedToolIndex === index}
                        onClick={() => setSelectedToolIndex(index)}
                      />
                    ))
                  : renderEmptyState()}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Tool Detail Panel */}
        <ResizablePanel defaultSize={70}>
          <div className="w-full h-full">
            {selectedTool ? (
              <div className="h-full overflow-y-auto pl-6 pr-12">
                <div className="sticky top-0 bg-background">
                  <h3 className="text-xl font-medium mb-4 flex items-center gap-2">
                    {selectedTool.name}
                  </h3>

                  {selectedTool.description && (
                    <ToolDescription
                      description={selectedTool.description}
                      showFullDescription={showFullDescription}
                      toggleDescription={toggleDescription}
                    />
                  )}

                  <Separator className="my-4" />
                </div>

                <div className="space-y-4 h-full ">
                  {selectedTool.inputSchema ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Schema View */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="text-xs font-medium">
                              Input Schema
                            </h5>
                            <Dialog
                              open={showInputSchema}
                              onOpenChange={setShowInputSchema}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  Detail <ChevronDown className="ml-1 size-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogPortal>
                                <DialogContent className="sm:max-w-[800px] fixed p-10 overflow-hidden">
                                  <DialogHeader>
                                    <DialogTitle>
                                      Input Schema: {selectedTool.name}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="overflow-y-auto max-h-[70vh]">
                                    <JsonView
                                      data={selectedTool.inputSchema}
                                      initialExpandDepth={3}
                                    />
                                  </div>
                                  <div className="absolute left-0 right-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
                                </DialogContent>
                              </DialogPortal>
                            </Dialog>
                          </div>

                          <div
                            className="border border-input rounded-md p-4 h-[200px] overflow-auto hover:bg-secondary cursor-pointer"
                            onClick={toggleInputSchema}
                          >
                            {simplifiedSchema &&
                            Object.keys(simplifiedSchema).length > 0 ? (
                              <div className="space-y-2">
                                {Object.entries(simplifiedSchema).map(
                                  ([key, value]) => (
                                    <SchemaProperty
                                      key={key}
                                      name={key}
                                      schema={value}
                                    />
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No schema properties available
                              </p>
                            )}
                          </div>
                        </div>

                        {/* JSON Input */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium mb-2 h-6 flex items-center">
                            Input JSON
                          </h5>
                          <Textarea
                            autoFocus
                            value={jsonInput}
                            onChange={(e) => handleInputChange(e.target.value)}
                            className="font-mono h-[200px] resize-none overflow-y-auto"
                            placeholder="{}"
                          />
                          {jsonError && jsonInput && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTitle className="text-xs font-semibold">
                                JSON Error
                              </AlertTitle>
                              <AlertDescription className="text-xs">
                                {jsonError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>

                      {/* Call Button */}
                      <div>
                        <Button
                          onClick={handleToolCall}
                          disabled={!!jsonError || isCallLoading}
                          className="w-full"
                        >
                          {isCallLoading && (
                            <Loader2 className="size-4 animate-spin mr-2" />
                          )}
                          Call Tool
                        </Button>
                      </div>

                      {/* Results Display */}
                      {!isNull(callResult) && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-medium">Result</h5>
                          {callResult.success ? (
                            <div className="border border-input rounded-md p-4 max-h-[300px] overflow-auto">
                              <JsonView
                                data={callResult.data}
                                initialExpandDepth={2}
                              />
                            </div>
                          ) : (
                            <Alert
                              variant="destructive"
                              className="mt-2 border-destructive"
                            >
                              <AlertTitle className="text-xs font-semibold">
                                Error
                              </AlertTitle>
                              <AlertDescription className="text-xs mt-2 text-destructive">
                                <pre className="whitespace-pre-wrap">
                                  {isString(callResult.error)
                                    ? callResult.error
                                    : JSON.stringify(callResult.error, null, 2)}
                                </pre>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-secondary/30 p-4 rounded-md">
                      <p className="text-sm text-center text-muted-foreground">
                        This tool doesn't have an input schema defined
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">
                  Select a tool from the left to test
                </p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
