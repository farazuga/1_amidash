import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getConfirmationRequestByToken } from '@/app/(dashboard)/calendar/confirmation-actions';
import { ConfirmationForm } from './confirmation-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Users, CheckCircle, XCircle } from 'lucide-react';

interface ConfirmationPageProps {
  params: Promise<{ token: string }>;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { token } = await params;

  const result = await getConfirmationRequestByToken(token);

  if (!result.success || !result.data) {
    notFound();
  }

  const { project_name, customer_name, dates, is_expired, is_responded, previous_response } = result.data;

  // Format dates for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Schedule Confirmation
          </h1>
          <p className="mt-2 text-gray-600">
            {project_name}
          </p>
        </div>

        {is_expired ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-red-600 flex items-center justify-center gap-2">
                <XCircle className="h-6 w-6" />
                Link Expired
              </CardTitle>
              <CardDescription>
                This confirmation link has expired. Please contact your project manager
                for a new confirmation request.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : is_responded ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className={previous_response === 'confirmed' ? 'text-green-600' : 'text-red-600'}>
                <div className="flex items-center justify-center gap-2">
                  {previous_response === 'confirmed' ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                  Already {previous_response === 'confirmed' ? 'Confirmed' : 'Declined'}
                </div>
              </CardTitle>
              <CardDescription>
                You have already responded to this confirmation request.
                {previous_response === 'confirmed'
                  ? ' The scheduled dates have been confirmed.'
                  : ' If you need to make changes, please contact your project manager.'}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Scheduled Dates
                </CardTitle>
                <CardDescription>
                  Dear {customer_name}, please review and confirm the following schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dates.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {formatDate(item.date)}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatTime(item.start_time)} - {formatTime(item.end_time)}
                          </span>
                          {item.engineers.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {item.engineers.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Suspense fallback={<div className="animate-pulse h-32 bg-gray-100 rounded-lg" />}>
              <ConfirmationForm token={token} projectName={project_name} />
            </Suspense>
          </>
        )}

        <p className="mt-8 text-center text-sm text-gray-500">
          If you have any questions, please contact your project manager.
        </p>
      </div>
    </div>
  );
}
