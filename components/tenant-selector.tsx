'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, User, Brain, Sparkles, Stethoscope } from 'lucide-react';
import { gptOssClient, AVAILABLE_TENANTS, TenantInfo } from '@/lib/api/gpt-oss-client';

interface TenantSelectorProps {
  onTenantChange?: (tenant: TenantInfo) => void;
  className?: string;
}

const tenantIcons = {
  amanda: Brain,
  robbie: Sparkles,
  emmer: Stethoscope,
  default: User,
};

export default function TenantSelector({ onTenantChange, className = '' }: TenantSelectorProps) {
  const [currentTenant, setCurrentTenant] = useState<TenantInfo>(AVAILABLE_TENANTS[0]);
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    // Check health status on mount
    checkHealth();
    
    // Set initial tenant
    const defaultTenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'amanda';
    const defaultTenant = AVAILABLE_TENANTS.find(t => t.id === defaultTenantId) || AVAILABLE_TENANTS[0];
    setCurrentTenant(defaultTenant);
    gptOssClient.setTenant(defaultTenant.id);
  }, []);

  const checkHealth = async () => {
    try {
      await gptOssClient.healthCheck();
      setIsHealthy(true);
    } catch (error) {
      console.error('Health check failed:', error);
      setIsHealthy(false);
    }
  };

  const handleTenantChange = (tenant: TenantInfo) => {
    setCurrentTenant(tenant);
    gptOssClient.setTenant(tenant.id);
    if (onTenantChange) {
      onTenantChange(tenant);
    }
  };

  const IconComponent = tenantIcons[currentTenant.id as keyof typeof tenantIcons] || User;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        <span className="text-sm text-gray-500">
          {isHealthy ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center space-x-2 min-w-[200px]">
            <IconComponent className="w-4 h-4" />
            <span className="flex-1 text-left">
              {currentTenant.name}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[250px]">
          <DropdownMenuLabel>Select Practice</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {AVAILABLE_TENANTS.map((tenant) => {
            const TenantIcon = tenantIcons[tenant.id as keyof typeof tenantIcons] || User;
            return (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleTenantChange(tenant)}
                className={`cursor-pointer ${currentTenant.id === tenant.id ? 'bg-accent' : ''}`}
              >
                <div className="flex items-center space-x-3 w-full">
                  <TenantIcon className="w-4 h-4" />
                  <div className="flex-1">
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-gray-500">{tenant.description}</div>
                  </div>
                  {currentTenant.id === tenant.id && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}